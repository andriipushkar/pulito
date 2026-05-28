# 2FA management (`setup`/`verify`/`disable`) + Google OAuth — аналіз

Дата аудиту: 2026-05-27.

## TOP-3 фіксів

### TF1. `/2fa/setup` без rate-limit

`route.ts:22-76` — endpoint generate-and-store TOTP secret + QR PNG. Авторизований користувач може loop ендпоінт: кожен виклик ротує `twoFactorSecret` у БД, скидає 30-min TTL у Redis. Не security-breaking, але DoS surface (QRCode.toDataURL CPU-bound) + state-churn.

**Fix:** `checkRateLimit(\`user:\${user.id}\`, RATE_LIMITS.sensitive)` (3 per 15min) — generous для legit "I clicked setup twice" flow, обмежує loop.

### TF2. `/2fa/disable` schema: `code.min(1)` пропускає будь-який рядок

`route.ts:10` — `z.string().min(1)`. TOTP має строгий формат 6 цифр; setup-verify використовує `regex(/^\d{6}$/)` — disable має бути такий самий. Інакше великі рядки доходять до `verifyTOTP`, який ймовірно тільки бере перші N символів → soft behaviour leakage.

**Fix:** `z.string().regex(/^\d{6}$/, 'Код має бути 6 цифр')`.

### GO1. Google OAuth callback без rate-limit

`callback/route.ts:15` — GET endpoint без `checkRateLimit`. State є HMAC-signed (захищає від CSRF), але атакувальник може спамити callback з garbage `code` → кожен виклик робить `exchangeCodeForTokens` (HTTP call до Google) → Google rate-limit на нашу OAuth app + впливає на legit users.

**Fix:** `checkRateLimit(ip, RATE_LIMITS.auth)` (10/min/IP) перед обробкою. На rate-limit — redirect на login з `?error=rate_limited`.

---

## Не потребує fix

- **2fa/verify** (setup verify) — уже має `2fa_setup_verify:${user.id}` 5/15min, cleanup на rate-limit-hit, audit логування. ✅
- **2fa/disable** rate-limit — `2fa_disable:${user.id}` 5/15min. ✅
- **2FA TTL 30min** для unverified secret + Redis key — добре mitigation для abandoned setups. ✅
- **Google OAuth state HMAC + timestamp** — захищає CSRF. ✅
- **Google OAuth state cookie removed** — multi-tab support. ✅
- **2FA temp token IP binding** — `iph` claim у tempToken (з попереднього auth audit). ✅
