/**
 * Mask PII for audit-log details. The audit log must show *what changed*
 * without storing raw personal data — so we keep field names and a masked
 * silhouette, never the full value.
 */

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '••••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••${digits.slice(-4)}`;
}

export function maskDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(value.length - 4)}${value.slice(-4)}`;
}

/**
 * Mask the middle of an IP address. IPv4 keeps first + last octet
 * (`192.x.x.5`); IPv6 / unknown shape keeps ends. Used in admin tables so
 * staff can spot patterns ("same /16 abusing us") without seeing full IPs.
 */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.x.x.${parts[3]}`;
  return ip.length > 12 ? `${ip.slice(0, 6)}…${ip.slice(-4)}` : ip;
}

const PII_MASKERS: Record<string, (v: string | null | undefined) => string | null> = {
  email: maskEmail,
  phone: maskPhone,
  edrpou: maskDigits,
  ipn: maskDigits,
  iban: maskDigits,
};

/**
 * Reduce an "edit" payload to a list of changed field names plus a masked
 * preview of each new value. Use this when storing user_edit details in the
 * audit log — keeps the trail readable without leaking raw email/phone/edrpou.
 */
export function maskUserEditDetails(
  data: Record<string, unknown>,
): { changedFields: string[]; preview: Record<string, string | null> } {
  const changedFields = Object.keys(data).filter((k) => data[k] !== undefined);
  const preview: Record<string, string | null> = {};
  for (const key of changedFields) {
    const raw = data[key];
    const str = raw === null || raw === undefined ? null : String(raw);
    const masker = PII_MASKERS[key];
    preview[key] = masker ? masker(str) : str;
  }
  return { changedFields, preview };
}
