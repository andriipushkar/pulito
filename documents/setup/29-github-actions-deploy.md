# Auto-deploy через GitHub Actions

Workflow `.github/workflows/deploy.yml` автоматично деплоїть на прод при push на `main`. Включає:

- TS + build перевірку перед deploy
- Pre-deploy backup БД (для rollback)
- Atomic release switching через symlink
- Prisma migrate deploy
- PM2 graceful reload (zero downtime)
- Health check з auto-rollback
- Cleanup старих releases (тримає останні 5)
- Telegram алерти

## One-time підготовка сервера

### 1. Структура директорій

На сервері створити:

```bash
sudo mkdir -p /app/releases /app/uploads /app/backups
sudo chown -R deploy:deploy /app
```

Структура:

```
/app/
├── releases/          ← кожен deploy сюди як окрема папка
│   ├── 20260506-130000-3de9619/
│   ├── 20260506-150000-44ffedb/
│   └── 20260506-170000-4d3ab74/
├── current             → симлінк на активну release (наприклад 20260506-170000-...)
├── uploads/            ← фото товарів, інвойси (НЕ всередині release, persist!)
├── backups/            ← pg_dump перед кожним deploy
└── .env                ← production env (sensitive, НЕ в git)
```

### 2. Перший release (manual bootstrap)

```bash
cd /app/releases
TIMESTAMP=$(date +%Y%m%d-%H%M%S)-bootstrap
git clone --depth 1 https://github.com/andriipushkar/clean.git $TIMESTAMP
cd $TIMESTAMP

# Симлінкі
ln -sfn /app/uploads $TIMESTAMP/uploads
ln -sfn /app/.env $TIMESTAMP/.env

# Build
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy

# Активувати
ln -sfn /app/releases/$TIMESTAMP /app/current

# Запустити PM2
cd /app/current
pm2 start npm --name clean-shop -- start
pm2 save
pm2 startup  # автозапуск після reboot
```

### 3. SSH-ключ для GitHub Actions

Створити окремий **deploy-only** SSH-ключ (НЕ використовуй свій особистий):

```bash
# На своєму локальному компі
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/clean_deploy
# (без passphrase — GitHub Actions не зможе ввести)
```

Скопіювати **public** key на сервер у `authorized_keys`:

```bash
ssh-copy-id -i ~/.ssh/clean_deploy.pub deploy@your-server-ip
```

Додатково обмежити цей ключ — тільки deploy-команди (опційно, для extra safety):

```bash
# На сервері в ~/.ssh/authorized_keys, перед ssh-ed25519:
command="cd /app && bash",no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA...
```

### 4. GitHub Secrets

Settings → Secrets and variables → Actions → New repository secret. Додати:

| Secret                   | Що                                                        |
| ------------------------ | --------------------------------------------------------- |
| `SERVER_HOST`            | IP або hostname прод-сервера, наприклад `123.45.67.89`    |
| `SERVER_USER`            | SSH user, наприклад `deploy`                              |
| `SSH_PRIVATE_KEY`        | Повний вміст файлу `~/.ssh/clean_deploy` (приватний ключ) |
| `PRODUCTION_URL`         | URL прода, наприклад `https://shop.example.com`           |
| `TELEGRAM_BOT_TOKEN`     | (опціонально) токен бота для алертів                      |
| `TELEGRAM_ADMIN_CHAT_ID` | (опціонально) chat ID куди слати алерти                   |

`SSH_PRIVATE_KEY` копіюй точно як є — з `-----BEGIN OPENSSH PRIVATE KEY-----` до `-----END OPENSSH PRIVATE KEY-----` включно.

### 5. Environment у GitHub

Settings → Environments → New environment → `production`.

Можеш додати **protection rules**:

- **Required reviewers** — хто має схвалити deploy перед запуском
- **Wait timer** — затримка перед deployment
- **Deployment branches** — тільки з `main`

Це зробить кожний deploy "ручним" — потрібен click в GitHub UI на approve. Корисно для критичних змін.

## Як деплоїти

### Автоматично

```bash
git push origin main
```

GitHub Actions сам:

1. Зробить TS + build перевірку (~2 хв)
2. SSH на сервер
3. Бекап БД
4. Clone новий release
5. npm ci + build + prisma migrate deploy
6. Switch symlink + PM2 reload
7. Health check
8. Cleanup старих releases
9. Telegram alert

Загальний час: 3-7 хвилин.

### Manually trigger (без push)

GitHub Actions tab → "Deploy to production" → "Run workflow" → обрати branch.

Опція `skip_backup: true` — пропустити бекап (тільки якщо щойно robably бекапил вручну).

## Rollback

### Автоматичний

Якщо health check провалився після deploy — workflow **сам відкатує** symlink на попередню release і робить PM2 reload. Telegram alert повідомляє.

⚠️ **Auto-rollback відкатує ТІЛЬКИ КОД**. Якщо нова міграція застосувалась і пошкодила дані — rollback цього не виправить. Restore з `/app/backups/predeploy-<release-id>.sql.gz`:

```bash
ssh deploy@server
ls -lt /app/backups/  # знайти найсвіжіший backup
gunzip -c /app/backups/predeploy-<release-id>.sql.gz | psql "$DATABASE_URL"
```

### Manual rollback (якщо auto не спрацював)

```bash
ssh deploy@server
cd /app/releases
ls -lt  # побачити список releases

# Перемкнути на попередню
ln -sfn /app/releases/<previous-id> /app/current
pm2 reload clean-shop
```

## Моніторинг деплоїв

- **GitHub Actions tab** — історія всіх deploy з логами кожного кроку
- **Telegram** — кожен success / failure з посиланням на logs
- **Server logs**:
  ```bash
  pm2 logs clean-shop --lines 100
  pm2 monit  # interactive monitor
  ```
- **Health endpoint**: `https://yourdomain.com/api/v1/health`

## Що не торкається deploy

Persistent дані які **НЕ** перезаписуються:

- ✅ PostgreSQL БД (повністю окрема служба)
- ✅ `/app/uploads/` (symlinked у release)
- ✅ `/app/.env` (symlinked у release)
- ✅ Redis (окрема служба)
- ✅ Logs (`/var/log/...`, `pm2 logs`)
- ✅ Старі releases (потрібні для rollback)

## Що робити коли треба зробити breaking-зміну БД

Приклад: видалити стару колонку, перейменувати таблицю.

**Не роби це за один deploy**. Multi-step pattern (zero-downtime breaking migrations):

### Phase 1 — Експонувати нове поряд зі старим

1. Migration: `ADD COLUMN new_field`
2. Code update: пише в обидва (`new_field` + старий) ; читає зі старого
3. Deploy phase 1.

### Phase 2 — Backfill даних

1. Run script: `UPDATE table SET new_field = transform(old_field) WHERE new_field IS NULL`
2. Verify все backfilled.

### Phase 3 — Перемкнути читання

1. Code update: читає з `new_field`, пише в обидва
2. Deploy phase 3.

### Phase 4 — Видалити старе

1. Code update: писати тільки в `new_field`
2. Migration: `DROP COLUMN old_field`
3. Deploy phase 4.

Сумарно 4 deploys замість одного, але **нуль downtime** і нуль ризику. Усі деплої безпечні незалежно один від одного — можна зупинитись між phase'ами.

## Рекомендований порядок дій для першого продом-deploy

1. ✅ Налаштувати сервер (Ubuntu, Node 20+, PM2, PostgreSQL, Nginx, SSL) — `documents/setup/02-production-vps.md`
2. ✅ Створити `/app/.env` зі всіма prod-ключами
3. ✅ Bootstrap перший release вручну (див. вище)
4. ✅ Створити SSH ключ і додати на сервер + у GitHub Secrets
5. ✅ Налаштувати GitHub Environment `production` з protection (опційно)
6. ✅ Тестовий deploy: невелика зміна → push → дивишся в GitHub Actions як йде
7. ✅ Коли вдалось — підключаєш людей до сайту

## Чек-ліст безпечного deploy

Перед натисканням `git push origin main`:

- [ ] Усі тести зелені локально (`npm test`)
- [ ] TypeScript чистий (`npm run typecheck`)
- [ ] Міграції зворотньо-сумісні (без DROP COLUMN/RENAME за один step)
- [ ] Якщо є breaking-зміни в API — клієнтський код вже сумісний
- [ ] Deploy не в пік-години (бажано 3-5 ранку)
- [ ] Перевірив що бекапи працюють (можна restore?)
- [ ] Telegram-канал відкритий — бачиш alert одразу

Якщо хоч один пункт `❌` — не пуш на main. Зробити PR, ще раз перевірити.
