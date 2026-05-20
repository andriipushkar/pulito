'use client';

/**
 * Renders audit-log "details" as a side-by-side diff when the payload has the
 * shape `{ field: { old: X, new: Y } }` or top-level `before`/`after` blobs.
 * Falls back to a JSON dump for anything else.
 */
export default function AuditDiff({ details }: { details: unknown }) {
  if (details === null || typeof details !== 'object') {
    return (
      <pre className="whitespace-pre-wrap break-words text-xs">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  }

  const obj = details as Record<string, unknown>;

  // Shape A: { before: {...}, after: {...} }
  if (obj.before && obj.after && typeof obj.before === 'object' && typeof obj.after === 'object') {
    const before = obj.before as Record<string, unknown>;
    const after = obj.after as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return (
      <table className="w-full text-xs">
        <thead className="text-left text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-2 py-1">Поле</th>
            <th className="px-2 py-1">Було</th>
            <th className="px-2 py-1">Стало</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <DiffRow key={k} field={k} oldVal={before[k]} newVal={after[k]} />
          ))}
        </tbody>
      </table>
    );
  }

  // Shape B: { fieldName: { old: X, new: Y }, ... }
  const fieldRows = Object.entries(obj).filter(
    ([, v]) => v && typeof v === 'object' && 'old' in (v as object) && 'new' in (v as object),
  );
  if (fieldRows.length > 0) {
    return (
      <table className="w-full text-xs">
        <thead className="text-left text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-2 py-1">Поле</th>
            <th className="px-2 py-1">Було</th>
            <th className="px-2 py-1">Стало</th>
          </tr>
        </thead>
        <tbody>
          {fieldRows.map(([k, v]) => {
            const pair = v as { old: unknown; new: unknown };
            return <DiffRow key={k} field={k} oldVal={pair.old} newVal={pair.new} />;
          })}
        </tbody>
      </table>
    );
  }

  // Fallback: raw JSON.
  return (
    <pre className="whitespace-pre-wrap break-words text-xs">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

function DiffRow({ field, oldVal, newVal }: { field: string; oldVal: unknown; newVal: unknown }) {
  const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
  return (
    <tr className={`border-t border-[var(--color-border)] ${changed ? '' : 'opacity-60'}`}>
      <td className="px-2 py-1 font-mono">{field}</td>
      <td className="px-2 py-1 text-red-700 line-through">{formatValue(oldVal)}</td>
      <td className="px-2 py-1 text-emerald-700">{formatValue(newVal)}</td>
    </tr>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
