# 18 — JWT RS256 налаштування

## Навіщо RS256 замість HS256

|                            | HS256 (symmetric)  | RS256 (asymmetric)                              |
| -------------------------- | ------------------ | ----------------------------------------------- |
| Ключ                       | Один shared secret | Пара: private + public                          |
| Хто може створювати токени | Будь-хто з secret  | Тільки сервер з private key                     |
| Хто може перевіряти токени | Будь-хто з secret  | Будь-хто з public key                           |
| Коли використовувати       | Один сервер, dev   | Production, мікросервіси, зовнішні верифікатори |

**Рекомендація:** На production завжди використовуйте RS256 — навіть якщо зараз один сервер, це безпечніше і дозволяє додати верифікацію токенів зовнішніми сервісами без розповсюдження secret.

## Крок 1 — Генерація ключів

```bash
# Створити директорію для ключів
mkdir -p keys

# Генерувати private key (2048 біт — мінімум для production)
openssl genrsa -out keys/private.pem 2048

# Витягти public key
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Обмежити доступ до private key
chmod 600 keys/private.pem
chmod 644 keys/public.pem
```

Перевірити що ключі коректні:

```bash
# Має вивести "RSA key ok"
openssl rsa -in keys/private.pem -check -noout

# Перевірити public key
openssl rsa -pubin -in keys/public.pem -text -noout | head -3
```

## Крок 2 — Змінні оточення

Додати в `.env`:

```env
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

> **Важливо:** Після зміни алгоритму всі існуючі HS256 токени стануть невалідними. Користувачам потрібно буде залогінитись заново.

## Крок 3 — Перевірка роботи

```bash
# 1. Перезапустити сервер
pm2 restart pulito

# 2. Залогінитись і перевірити що токен — RS256
curl -s http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | jq -r '.accessToken' \
  | cut -d. -f1 \
  | base64 -d 2>/dev/null

# В header має бути: {"alg":"RS256","typ":"JWT"}
```

## Крок 4 — Бекап private key

Private key — критичний секрет. Якщо його втратити, всі токени стануть невалідними.

```bash
# Зашифрований бекап
openssl aes-256-cbc -salt -in keys/private.pem -out private.pem.enc -pbkdf2

# Зберегти private.pem.enc у безпечному місці (password manager, encrypted backup)
# НЕ комітити в git!
```

Переконайтесь що `keys/` додано в `.gitignore`:

```bash
echo "keys/" >> .gitignore
```

## Крок 5 — Ротація ключів (при потребі)

Ротацію потрібно робити якщо:

- Private key скомпрометований
- Політика безпеки вимагає періодичної ротації
- Змінюється розмір ключа

Процедура:

```bash
# 1. Згенерувати нову пару
openssl genrsa -out keys/private-new.pem 2048
openssl rsa -in keys/private-new.pem -pubout -out keys/public-new.pem
chmod 600 keys/private-new.pem

# 2. Замінити ключі
mv keys/private.pem keys/private-old.pem
mv keys/public.pem keys/public-old.pem
mv keys/private-new.pem keys/private.pem
mv keys/public-new.pem keys/public.pem

# 3. Перезапустити сервер
pm2 restart pulito

# 4. Старі токени стануть невалідними — користувачі перелогіняться
# 5. Через добу видалити старі ключі
rm keys/private-old.pem keys/public-old.pem
```

## Troubleshooting

| Проблема                                       | Рішення                                                         |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `Error: secretOrPrivateKey must be asymmetric` | Файл `private.pem` пошкоджений — перегенеруйте                  |
| `JsonWebTokenError: invalid algorithm`         | Перевірте `JWT_ALGORITHM=RS256` в `.env`                        |
| `Error: ENOENT private.pem`                    | Перевірте `JWT_PRIVATE_KEY_PATH` — шлях відносно кореня проєкту |
| Токени не приймаються після деплою             | Перевірте що `keys/` скопійовані на сервер                      |
| `Error: PEM_read_bio`                          | Файл не у форматі PEM — перегенеруйте командами вище            |
