type Role = 'admin' | 'manager' | 'client' | 'wholesaler';

// Fields that only admins should see — defense-in-depth against data leaks.
// `adminNote` is a private comment about the customer (e.g. "do not refund —
// chargeback history") that managers shouldn't see.
const ADMIN_ONLY_FIELDS = [
  'passwordHash',
  'twoFactorSecret',
  'googleId',
  'ipAddress',
  'deviceInfo',
  'telegramChatId',
  'viberUserId',
  'adminNote',
];

export function filterByRole<T extends Record<string, unknown>>(data: T, role: Role): T {
  if (role === 'admin') return data;

  const filtered = { ...data };
  for (const field of ADMIN_ONLY_FIELDS) {
    if (field in filtered) {
      delete filtered[field];
    }
  }
  return filtered;
}

export function filterArrayByRole<T extends Record<string, unknown>>(data: T[], role: Role): T[] {
  if (role === 'admin') return data;
  return data.map(item => filterByRole(item, role));
}
