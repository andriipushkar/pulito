import type { Metadata } from 'next';
import { buildHreflang } from '@/lib/i18n';
import { Link } from '@/i18n/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { getLoyaltyLevels } from '@/services/loyalty';
import { getSettings } from '@/services/settings';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Бонусна програма — Pulito Trade',
  description:
    'Накопичуйте бали з кожного замовлення, отримуйте знижки на наступні покупки. Рівні Bronze, Silver, Gold, Platinum. Запрошуйте друзів і отримуйте додаткові бонуси.',
  alternates: {
    canonical: `${baseUrl}/loyalty`,
    languages: buildHreflang('/loyalty'),
  },
  openGraph: {
    title: 'Бонусна програма Pulito Trade',
    description:
      'Накопичуйте бали з кожного замовлення, отримуйте знижки на наступні покупки. 1 бал = 1 ₴.',
    url: `${baseUrl}/loyalty`,
    siteName: 'Pulito Trade',
    type: 'website',
    images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Бонусна програма Pulito Trade',
    description:
      'Накопичуйте бали з кожного замовлення, отримуйте знижки на наступні покупки. 1 бал = 1 ₴.',
    images: [`${baseUrl}/opengraph-image`],
  },
};

// Static design metadata for tiers — order matches DB sortOrder convention.
const TIER_VISUAL: Record<string, { label: string; emoji: string; ring: string }> = {
  bronze: { label: 'Bronze', emoji: '🥉', ring: 'ring-amber-700/40' },
  silver: { label: 'Silver', emoji: '🥈', ring: 'ring-slate-400/60' },
  gold: { label: 'Gold', emoji: '🥇', ring: 'ring-yellow-500/60' },
  platinum: { label: 'Platinum', emoji: '💎', ring: 'ring-cyan-400/60' },
};

export default async function LoyaltyLandingPage() {
  const [levels, settings] = await Promise.all([getLoyaltyLevels(), getSettings()]);
  const welcomeBonus = Number(settings.loyalty_welcome_bonus) || 0;
  const refReferrer = Number(settings.referral_referrer_bonus) || 0;
  const refReferee = Number(settings.referral_referee_bonus) || 0;

  const breadcrumbs = [{ label: 'Головна', href: '/' }, { label: 'Бонусна програма' }];

  return (
    <Container className="py-6">
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <header className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold sm:text-4xl">Бонусна програма Pulito Trade</h1>
        <p className="mx-auto max-w-2xl text-base text-[var(--color-text-secondary)]">
          Накопичуйте бали з кожного замовлення і витрачайте їх на наступні покупки.
          <strong> 1 бал = 1 ₴ знижки.</strong> Чим більше купуєте — тим вищий рівень і більший
          відсоток нарахування.
        </p>
      </header>

      {/* Quick wins block */}
      <section className="mb-12 grid gap-4 sm:grid-cols-3">
        {welcomeBonus > 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-center">
            <div className="mb-2 text-3xl">🎁</div>
            <h3 className="mb-1 font-semibold">Вітальний бонус</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-primary)]">+{welcomeBonus} балів</strong> одразу
              після реєстрації — без жодних умов.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-center">
          <div className="mb-2 text-3xl">🛒</div>
          <h3 className="mb-1 font-semibold">Бали за покупки</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            <strong className="text-[var(--color-primary)]">1 ₴ = 1 бал</strong> на базовому рівні.
            Із кожним новим рівнем — множник збільшується.
          </p>
        </div>
        {(refReferrer > 0 || refReferee > 0) && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-center">
            <div className="mb-2 text-3xl">👥</div>
            <h3 className="mb-1 font-semibold">Запросіть друга</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {refReferrer > 0 && (
                <>
                  Ви — <strong className="text-[var(--color-primary)]">+{refReferrer}</strong>
                </>
              )}
              {refReferrer > 0 && refReferee > 0 && ', '}
              {refReferee > 0 && (
                <>
                  друг — <strong className="text-[var(--color-primary)]">+{refReferee}</strong>
                </>
              )}{' '}
              балів за перше замовлення друга.
            </p>
          </div>
        )}
      </section>

      {/* Tiers */}
      {levels.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold">Рівні програми</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map((lvl) => {
              const visual = TIER_VISUAL[lvl.name.toLowerCase()] || {
                label: lvl.name,
                emoji: '⭐',
                ring: 'ring-[var(--color-primary)]/40',
              };
              return (
                <div
                  key={lvl.id}
                  className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 ring-2 ${visual.ring}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-4xl">{visual.emoji}</div>
                    <span className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                      {visual.label}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
                    Від {Number(lvl.minSpent).toLocaleString('uk-UA')} ₴ загальних витрат
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div>
                      <strong>×{lvl.pointsMultiplier}</strong> бали з кожної покупки
                    </div>
                    {Number(lvl.discountPercent) > 0 && (
                      <div>
                        <strong>{Number(lvl.discountPercent)}%</strong> постійна знижка
                      </div>
                    )}
                    {lvl.pointsExpiryMonths && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Бали діють {lvl.pointsExpiryMonths} міс. після нарахування
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Як це працює</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: '1',
              t: 'Реєструйтеся',
              d: 'Створіть акаунт — отримайте вітальні бали одразу.',
            },
            {
              n: '2',
              t: 'Робіть покупки',
              d: 'З кожного замовлення нараховуються бали відповідно до вашого рівня.',
            },
            {
              n: '3',
              t: 'Витрачайте на checkout',
              d: 'При оформленні замовлення оберіть «Списати бали» — отримаєте знижку 1 бал = 1 ₴.',
            },
            {
              n: '4',
              t: 'Підвищуйте рівень',
              d: 'Чим більше купуєте — тим вищий рівень, більший множник і додаткова знижка.',
            },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-lg font-bold text-white">
                {step.n}
              </div>
              <h3 className="mb-1 font-semibold">{step.t}</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Часті питання</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Скільки балів я отримую за покупку?',
              a: '1 ₴ = 1 бал на базовому рівні (Bronze). На вищих рівнях діє множник: наприклад, ×1.5 на Gold означає 1.5 балів за кожну гривню. Бали нараховуються після завершення замовлення (статус «Виконано»).',
            },
            {
              q: 'Як витратити бали?',
              a: 'На сторінці оформлення замовлення вкажіть кількість балів, які хочете списати. 1 бал = 1 ₴ знижки. Можна списати скільки маєте.',
            },
            {
              q: 'Чи можна оплатити замовлення тільки балами?',
              a: 'Так — якщо у вас достатньо балів, замовлення може бути повністю оплачене бонусами. Доставка оплачується окремо.',
            },
            {
              q: 'Чи бали мають термін дії?',
              a: 'Залежить від вашого рівня. На більшості рівнів термін дії становить кілька місяців з моменту нарахування — точну інформацію дивіться у таблиці рівнів вище.',
            },
            {
              q: 'Чи отримую бали за скасоване замовлення?',
              a: 'Ні. Якщо замовлення скасовано або повернено — нараховані бали анулюються, а списані бали повертаються на ваш баланс.',
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
            >
              <summary className="cursor-pointer list-none font-semibold">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                {f.q}
              </summary>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] p-8 text-center text-white">
        <h2 className="mb-2 text-2xl font-bold">Готові почати?</h2>
        <p className="mb-5 text-sm opacity-90">
          Зареєструйтеся за хвилину і отримайте {welcomeBonus > 0 ? `${welcomeBonus} ` : ''}балів
          одразу на свій рахунок.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-white/90"
          >
            Зареєструватися
          </Link>
          <Link
            href="/catalog"
            className="rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20"
          >
            До каталогу
          </Link>
        </div>
      </section>
    </Container>
  );
}
