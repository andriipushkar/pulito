# `/auth/2fa/verify-login` + `/uploads/[...path]` + `/r/c/[logId]` — аналіз

Дата аудиту: 2026-05-27.

## TOP-5 фіксів

### OR1. `/r/c/[logId]` open-redirect bypass через `endsWith('pulito.trade')`

`route.ts:28` — `parsed.hostname.endsWith('pulito.trade')`. Атакувальник реєструє `evil-pulito.trade` (або взагалі будь-який домен закінчуючись на `pulito.trade` як substring) → `'evil-pulito.trade'.endsWith('pulito.trade')` === `true` → 302 redirect ведуть phishing-сайт. Email кампанії з нашим доменом стають phishing vector.

**Fix:** `parsed.hostname === 'pulito.trade' || parsed.hostname.endsWith('.pulito.trade')` — додаткова крапка обмежує до true-subdomains.

### OR2. `/r/c/[logId]` localhost дозволений у production

`route.ts:28` — `parsed.hostname === 'localhost'`. У production це SSRF-ish risk: якщо хтось подасть `?to=http://localhost:6379`, redirect-сценарій сам по собі harmless (browser їде до localhost атакувальника), але як signal — це показ що localhost approved у allow-list. Краще обмежити до dev.

**Fix:** `&& env !== 'production'` для localhost case.

### UP1. `/uploads/[...path]`: symlink resolution не перевіряється

`route.ts:31` — `if (!filePath.startsWith(uploadDir))`. Перевірка робиться після `path.join` (синтаксична нормалізація), але не після resolve symlinks. Якщо хтось (admin з file-system access або bug у admin upload code) створить symlink `uploads/secret.png → /etc/passwd`, то `filePath = /home/.../uploads/secret.png` пройде startsWith check, потім `fs.readFile` піде по symlink → leak.

**Fix:** використати `fs.realpath(filePath)` та перевірити що resolved шлях все ще всередині `uploadDir`.

### TF1. `2fa/verify-login`: Zod без формату коду + `console.warn` замість logger

`route.ts:13-15` — `code: z.string().min(1)` пропускає будь-який рядок. TOTP — це строго 6 цифр; backup code — 8 hex (per totp.ts). Атакувальник може засабмітити велику строку, а TOTP лібра ймовірно валідує по перших N символах → behavior leakage.
`route.ts:53` — `console.warn` замість `logger.warn`. Inconsistent логування — те що пишеться через console.warn не йде у Sentry/logfile pipeline.

**Fix:** Zod `code: z.string().regex(/^(\d{6}|[a-f0-9]{8})$/, 'Невалідний формат коду')` + замінити `console.warn` на `logger.warn`.

### OR3. `/r/c/[logId]`: відсутній rate-limit

Хоч open-redirect закритий (після OR1+OR2 fix), endpoint все ще unauthenticated GET що пише у БД (`campaignLog.update`). Атакувальник може засипати тисячами requests з різними `logId` → DB-write storm.

**Fix:** `checkRateLimit(ip, RATE_LIMITS.api)` 60/min/IP.

---

## Не потребує fix

- **Uploads SVG/HTML escape** — вже примусово `Content-Disposition: attachment` для `.svg/.html/.htm`. OK.
- **Path traversal `..` check** — `relativePath.includes('..')` + post-join `startsWith` — OK для basic case.
- **2fa rate-limit** — `2fa_verify:${tempToken.slice(-16)}` 5 спроб / 15min — обмежує brute-force TOTP (10^6 keyspace × 5 attempts/quarter = впізнавано). OK.
- **2fa IP-binding** — `verifyTwoFactorLogin` перевіряє `iph` (IP hash) у tempToken (з auth.ts:216). OK.
- **`fs.readFile` буфером** — perf issue (100MB file = 100MB allocation), але не security. Окремо у performance audit.
