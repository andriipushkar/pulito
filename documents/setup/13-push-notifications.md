# 13. Push-сповіщення (VAPID)

## Що таке VAPID і навіщо потрібні

VAPID (Voluntary Application Server Identification) — це стандарт ідентифікації сервера, який надсилає push-сповіщення. Браузер перевіряє VAPID-ключі, щоб переконатися, що сповіщення приходять саме від вашого сервера, а не від зловмисника.

Без VAPID-ключів push-сповіщення **не працюватимуть**.

---

## Крок 1: Згенерувати VAPID-ключі

Виконайте команду в корені проєкту:

```bash
npx web-push generate-vapid-keys
```

Результат буде приблизно таким:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs-kMD2JJxwa...

Private Key:
Dl9HCgFJ-k2QkOxWDgsXMg9mF2rlPc3KRwQIdGV7Fxk

=======================================
```

---

## Крок 2: Додати змінні до `.env`

```env
# Push-сповіщення (VAPID)
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs-kMD2JJxwa...
VAPID_PRIVATE_KEY=Dl9HCgFJ-k2QkOxWDgsXMg9mF2rlPc3KRwQIdGV7Fxk
VAPID_EMAIL=mailto:admin@yourdomain.com
```

> **Важливо:** `VAPID_EMAIL` має починатися з `mailto:` — це вимога стандарту.

---

## Крок 3: Перевірити роботу

1. Відкрийте сайт у браузері (Chrome або Firefox).
2. Браузер запитає дозвіл на сповіщення — дозвольте.
3. Перевірте, що підписка збереглася, через API:

```bash
curl -s http://localhost:3000/api/v1/push/subscriptions | jq
```

4. Надішліть тестове сповіщення з адмін-панелі або через API:

```bash
curl -X POST http://localhost:3000/api/v1/push/send-test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ваш-токен>" \
  -d '{"title": "Тест", "body": "Push працює!"}'
```

---

## Крок 4: Продакшн

На продакшн-сервері додайте ті самі змінні до `.env` (або в PM2 ecosystem). Ключі мають бути **однаковими** на dev і prod, якщо ви хочете, щоб підписки залишалися валідними.

---

## Усунення проблем

| Проблема | Рішення |
|----------|---------|
| Сповіщення не приходять | Перевірте, що сайт відкрито через **HTTPS** (або `localhost`). Push API не працює на HTTP. |
| Браузер не запитує дозвіл | Перевірте, що браузер підтримує Push API (Chrome 50+, Firefox 44+, Edge 17+, Safari 16.1+). |
| `UnauthorizedRegistration` помилка | VAPID-ключі змінилися після того, як користувач підписався. Потрібно перепідписати. |
| `PayloadTooLarge` | Тіло сповіщення не може перевищувати 4 KB. Скоротіть текст. |
| Не працює в Safari | Safari на macOS підтримує push з версії 16.1. На iOS — з версії 16.4 (потрібно додати сайт на Home Screen). |
| Service Worker не реєструється | Перевірте, що файл `sw.js` доступний у корені сайту і віддається з правильним `Content-Type: application/javascript`. |
