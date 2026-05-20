const BADGE_BASE =
  'flex h-7 items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase tracking-tight shadow-sm';

function NovaPoshta() {
  return (
    <span
      className={`${BADGE_BASE} bg-[#E2231A] text-white`}
      aria-label="Нова Пошта"
    >
      Нова Пошта
    </span>
  );
}

function Ukrposhta() {
  return (
    <span
      className={`${BADGE_BASE} bg-[#FFD500] text-[#1A1A1A]`}
      aria-label="Укрпошта"
    >
      Укрпошта
    </span>
  );
}

export default function DeliveryBadges() {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Способи доставки">
      <NovaPoshta />
      <Ukrposhta />
    </div>
  );
}
