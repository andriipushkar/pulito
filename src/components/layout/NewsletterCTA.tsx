import Container from '@/components/ui/Container';
import SubscriptionForm from './SubscriptionForm';

export default function NewsletterCTA() {
  return (
    <section
      aria-labelledby="newsletter-cta-heading"
      className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-primary-light)] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.35) 0, transparent 40%)',
        }}
      />
      <Container className="relative grid items-center gap-6 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Лише для підписників
          </span>
          <h2
            id="newsletter-cta-heading"
            className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl lg:text-[2rem]"
          >
            −10% на перше замовлення
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">
            Підпишіться на новини — і отримайте промокод на знижку, ранній доступ до акцій
            та новинок.
          </p>
        </div>
        <div className="lg:max-w-md lg:justify-self-end">
          <SubscriptionForm variant="light" />
        </div>
      </Container>
    </section>
  );
}
