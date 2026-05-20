export function HelpTooltip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[10px] font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white"
    >
      ?
    </span>
  );
}
