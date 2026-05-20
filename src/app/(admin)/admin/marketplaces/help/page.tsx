'use client';

import { useState } from 'react';

const SECTIONS = [
  { id: 'overview', label: '🚀 Огляд' },
  { id: 'olx', label: '🟢 OLX' },
  { id: 'rozetka', label: '🟩 Rozetka' },
  { id: 'prom', label: '🔵 Prom.ua' },
  { id: 'epicentrk', label: '🟠 Epicentr K' },
  { id: 'workflow', label: '📦 Робочий процес' },
  { id: 'messages', label: '💬 Повідомлення' },
  { id: 'returns', label: '↩ Повернення' },
  { id: 'troubleshooting', label: '🛠 Усунення несправностей' },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-8 mb-3 scroll-mt-20 text-xl font-bold">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex gap-3 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
        {n}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' }) {
  const cls =
    type === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-900';
  return (
    <div className={`my-3 rounded-[var(--radius)] border px-3 py-2 text-sm ${cls}`}>{children}</div>
  );
}

export default function MarketplacesHelpPage() {
  const [active, setActive] = useState('overview');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Довідка: інтеграції з маркетплейсами</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Покрокові інструкції з налаштування та роботи з OLX, Rozetka, Prom.ua та Epicentr K.
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="sticky top-4 hidden h-fit w-56 shrink-0 space-y-1 md:block">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={`block rounded px-3 py-1.5 text-sm transition-colors ${
                active === s.id
                  ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <article className="prose-sm max-w-none flex-1 text-sm text-[var(--color-text)]">
          <H id="overview">🚀 Огляд</H>
          <p>
            Адмінпанель дозволяє в одному місці керувати товарами на чотирьох маркетплейсах:
            <strong> OLX, Rozetka, Prom.ua та Epicentr K</strong>. З панелі можна:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>публікувати товари (з автоматичною націнкою та квотою залишку);</li>
            <li>імпортувати замовлення з усіх маркетплейсів (автоматично через cron);</li>
            <li>відповідати на повідомлення покупців прямо з адмінки;</li>
            <li>опрацьовувати повернення та спори;</li>
            <li>бачити аналітику продажів і здоров&apos;я API.</li>
          </ul>

          <Note>
            <strong>Базовий процес:</strong> 1) у «Налаштуваннях API» вводите токени та натискаєте
            <em> Перевірити підключення</em>; 2) у вкладці «Публікація товарів» вибираєте товар і
            натискаєте <em>Опублікувати</em>; 3) замовлення приходять автоматично кожні 30 хв;
            4) на повідомлення відповідаєте з вкладки «Повідомлення».
          </Note>

          <H id="olx">🟢 OLX</H>
          <H3>Як отримати ключі</H3>
          <Step n={1}>
            Зареєструйтесь у{' '}
            <a
              href="https://developer.olx.ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              OLX Partner Portal
            </a>{' '}
            як продавець.
          </Step>
          <Step n={2}>
            Створіть нову інтеграцію (Application). В налаштуваннях вкажіть Redirect URI:{' '}
            <Code>https://pulito.trade/api/v1/admin/marketplaces/olx/oauth-callback</Code>.
          </Step>
          <Step n={3}>
            Отримайте <Code>client_id</Code> та <Code>client_secret</Code>. Вставте їх у форму OLX
            в «Налаштуваннях API».
          </Step>
          <Step n={4}>
            Натисніть <em>Запустити OAuth</em> — відкриється вікно OLX. Дайте дозвіл — токени
            підтягнуться автоматично.
          </Step>
          <Note type="warn">
            <strong>Токен діє ~30 днів.</strong> Cron оновлює його автоматично. Якщо в бейджі біля
            маркетплейсу бачите <em>⚠ Токен прострочено</em> — натисніть <em>Оновити токен</em>.
          </Note>

          <H id="rozetka">🟩 Rozetka</H>
          <Step n={1}>
            Зайдіть у{' '}
            <a
              href="https://seller.rozetka.com.ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              Rozetka Seller
            </a>{' '}
            → Інтеграції → API.
          </Step>
          <Step n={2}>
            Створіть API-ключ. Скопіюйте та збережіть у полі <em>API Key</em>.
          </Step>
          <Step n={3}>
            Вкажіть <em>Seller ID</em> — це ваш числовий ID продавця, видно в URL кабінету.
          </Step>
          <Step n={4}>
            Натисніть <em>Перевірити підключення</em>. Якщо відповідь
            <em> Rozetka Seller #...</em> — все правильно.
          </Step>

          <H id="prom">🔵 Prom.ua</H>
          <Step n={1}>
            У{' '}
            <a
              href="https://my.prom.ua/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              кабінеті Prom.ua
            </a>{' '}
            → API згенеруйте токен з правами «Товари», «Замовлення», «Повідомлення».
          </Step>
          <Step n={2}>
            Вставте у поле <em>API Token</em> і збережіть.
          </Step>

          <H id="epicentrk">🟠 Epicentr K</H>
          <Step n={1}>
            Зверніться до менеджера Epicentr K за API-ключем для маркетплейсу{' '}
            <Code>marketplace.epicentrk.ua</Code>.
          </Step>
          <Step n={2}>
            Вставте у поле <em>API Key</em>.
          </Step>
          <Note type="warn">
            Epicentr K <strong>не має API для відповідей на повідомлення</strong> покупців —
            відповідайте через веб-кабінет продавця. Решта функцій (публікація, замовлення,
            повернення) працює.
          </Note>

          <H id="workflow">📦 Робочий процес публікації товару</H>
          <Step n={1}>
            <strong>Mapping категорій.</strong> Перейдіть у <em>Маркетплейси → Mapping категорій</em>.
            Зіставте локальні категорії з категоріями кожного маркетплейсу. Без mapping товари
            публікуються у дефолтну категорію.
          </Step>
          <Step n={2}>
            <strong>Налаштуйте націнку.</strong> У <em>Settings → Markup</em> для кожного маркетплейсу
            вкажіть відсоток або фіксовану суму (компенсує комісію маркетплейсу).
          </Step>
          <Step n={3}>
            <strong>Квота залишку.</strong> Поле <em>stockAllocationPercent</em> (0-100) — який
            відсоток локального залишку показувати на цьому маркетплейсі. Захищає від оверселу при
            продажах одночасно в кількох місцях.
          </Step>
          <Step n={4}>
            <strong>Публікуйте.</strong> У вкладці <em>Публікація товарів</em> виберіть товари та
            натисніть <em>Опублікувати</em> на потрібний маркетплейс.
          </Step>
          <Step n={5}>
            <strong>Залишки синхронізуються автоматично</strong> — після кожного імпортованого
            замовлення локальний залишок зменшується, і нове значення відправляється на всі
            маркетплейси, де товар опублікований.
          </Step>

          <H id="messages">💬 Робота з повідомленнями</H>
          <p>Вкладка <em>Повідомлення</em> об&apos;єднує месенджі покупців з усіх маркетплейсів.</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Фільтри:</strong> по маркетплейсу, по менеджеру, лише непрочитані, лише без
              відповіді.
            </li>
            <li>
              <strong>Призначення.</strong> Випадаючий список «без менеджера» біля кожного
              повідомлення дозволяє розподілити роботу між адмінами/менеджерами.
            </li>
            <li>
              <strong>Шаблони.</strong> Створіть готові відповіді в <em>API повідомленнях</em>
              (POST /api/v1/admin/marketplaces/reply-templates). Підставляйте їх у відповідь одним
              кліком.
            </li>
            <li>
              <strong>SLA-індикатор.</strong> ⏱ біля повідомлення показує час очікування. Жовтий
              &gt; 1 год, червоний &gt; 4 год — спершу беріть найгарячіші.
            </li>
          </ul>

          <H id="returns">↩ Повернення та спори</H>
          <p>
            <em>Маркетплейси → Повернення:</em> синхронізуються через cron з кожних 30 днів. Кнопки
            <em> Підтвердити / Відхилити / Завершити</em> змінюють статус і
            <strong> автоматично пушать рішення на маркетплейс</strong> (де API підтримує:
            Rozetka, Prom). Для OLX та Epicentr K статус оновлюється тільки локально — рішення
            треба підтвердити в кабінеті продавця.
          </p>
          <p>
            <em>Маркетплейси → Спори:</em> агрегує скарги з OLX та Rozetka. Червоним підсвічуються
            спори з дедлайном &lt; 24 год — на них треба відповідати в кабінеті маркетплейсу.
          </p>

          <H id="troubleshooting">🛠 Усунення несправностей</H>
          <H3>Червоний бейдж «помилка підключення»</H3>
          <p>
            Натисніть <em>Перевірити підключення</em>. Якщо помилка лишається — перевірте токен,
            він міг прострочитись. Для OLX — натисніть <em>Оновити токен</em>.
          </p>

          <H3>Товар не публікується: «Невалідна категорія»</H3>
          <p>
            Зайдіть у <em>Mapping категорій</em> і додайте відповідник для локальної категорії
            товару. Без mapping — використовується дефолтна (часто не пропускає валідацію).
          </p>

          <H3>Помилка «Перепродаж» у Telegram</H3>
          <p>
            Замовлення пройшло на маркетплейсі, але локально товару вже не було. Подивіться в
            замовлення (Telegram-повідомлення містить лінк) і вирішіть: дозамовити, скасувати, чи
            запропонувати клієнту альтернативу.
          </p>

          <H3>Кредеї маркетплейсу зникли після збереження</H3>
          <p>
            <strong>Виправлено 2026-05-17:</strong> тепер поля з токеном захищені — щоб змінити
            токен, треба натиснути <em>Змінити</em>. Порожнє значення не перезаписує токен.
          </p>

          <H3>Cron не імпортує замовлення</H3>
          <p>
            Перевірте <Code>/api/v1/cron/sync-marketplace-orders</Code> — ендпоінт повертає JSON з
            результатами по кожному маркетплейсу. Якщо <Code>failed: -1</Code> — є помилка
            підключення.
          </p>

          <Note>
            <strong>Більше документації:</strong> технічний референс у файлі{' '}
            <Code>MARKETPLACES.md</Code> у корені репо.
          </Note>
        </article>
      </div>
    </div>
  );
}
