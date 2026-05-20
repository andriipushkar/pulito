const BADGE_BASE =
  'flex h-7 items-center justify-center rounded-md bg-white/95 px-2 shadow-sm ring-1 ring-black/5';

function Visa() {
  return (
    <span className={BADGE_BASE} aria-label="Visa">
      <svg viewBox="0 0 64 20" className="h-3.5 w-auto" role="img" aria-hidden="true">
        <text
          x="0"
          y="16"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight={800}
          fontSize="18"
          letterSpacing="1.5"
          fill="#1A1F71"
          fontStyle="italic"
        >
          VISA
        </text>
      </svg>
    </span>
  );
}

function Mastercard() {
  return (
    <span className={BADGE_BASE} aria-label="Mastercard">
      <svg viewBox="0 0 32 20" className="h-4 w-auto" role="img" aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill="#EB001B" />
        <circle cx="20" cy="10" r="7" fill="#F79E1B" />
        <path
          d="M16 4.6a7 7 0 0 1 0 10.8 7 7 0 0 1 0-10.8z"
          fill="#FF5F00"
        />
      </svg>
    </span>
  );
}

function ApplePay() {
  return (
    <span className={BADGE_BASE} aria-label="Apple Pay">
      <svg viewBox="0 0 40 16" className="h-3.5 w-auto" role="img" aria-hidden="true">
        <text
          x="0"
          y="12"
          fontFamily="-apple-system, system-ui, sans-serif"
          fontWeight={600}
          fontSize="13"
          fill="#000"
        >
          Pay
        </text>
        <path
          d="M-2 4.5c.6 0 1.2-.4 1.5-.9.3-.4.5-1 .4-1.5-.5 0-1.1.3-1.4.7-.3.4-.6 1-.5 1.7zm.5.6c-.8 0-1.5.5-1.9.5s-1-.4-1.7-.4c-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 4 .7 5.3.4.6.9 1.3 1.6 1.3.6 0 .9-.4 1.7-.4s1 .4 1.7.4 1.2-.6 1.6-1.3c.5-.7.7-1.4.7-1.5 0 0-1.4-.5-1.4-2.1 0-1.3 1-1.9 1.1-2-.6-.9-1.5-1-1.8-1z"
          fill="#000"
          transform="translate(8 0)"
        />
      </svg>
    </span>
  );
}

function GooglePay() {
  return (
    <span className={BADGE_BASE} aria-label="Google Pay">
      <svg viewBox="0 0 56 16" className="h-3.5 w-auto" role="img" aria-hidden="true">
        <text x="0" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#4285F4">G</text>
        <text x="7" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#EA4335">o</text>
        <text x="13" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#FBBC04">o</text>
        <text x="19" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#4285F4">g</text>
        <text x="25" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#34A853">l</text>
        <text x="28" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#EA4335">e</text>
        <text x="35" y="12" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="11" fill="#5F6368">Pay</text>
      </svg>
    </span>
  );
}

function LiqPay() {
  return (
    <span
      className="flex h-7 items-center justify-center rounded-md bg-[#7AB72B] px-2 text-[11px] font-bold tracking-tight text-white shadow-sm"
      aria-label="LiqPay"
    >
      LiqPay
    </span>
  );
}

function Mono() {
  return (
    <span
      className="flex h-7 items-center justify-center rounded-md bg-black px-2 text-[11px] font-semibold lowercase text-white shadow-sm"
      aria-label="monobank"
    >
      mono
    </span>
  );
}

function Privat() {
  return (
    <span
      className="flex h-7 items-center justify-center rounded-md bg-[#37b34a] px-2 text-[11px] font-bold uppercase tracking-tight text-white shadow-sm"
      aria-label="Privat24"
    >
      Privat24
    </span>
  );
}

export default function PaymentBadges() {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Способи оплати">
      <Visa />
      <Mastercard />
      <ApplePay />
      <GooglePay />
      <LiqPay />
      <Mono />
      <Privat />
    </div>
  );
}
