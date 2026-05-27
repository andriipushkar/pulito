import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/../generated/prisma';

export type SegmentField = 'orderCount' | 'totalSpent' | 'lastOrderDays' | 'city';
export type SegmentOp = 'gte' | 'lte' | 'eq' | 'contains';

export interface SegmentRule {
  field: SegmentField;
  op: SegmentOp;
  value: string | number;
}

export interface SegmentInput {
  rules: SegmentRule[];
  /** Optional limit on the user list returned. Aggregate counts ignore this. */
  limit?: number;
  /** Offset for pagination — useful when exporting 10k+ matched users. */
  offset?: number;
  /**
   * Roles to include. Defaults to retail only (`['client']`) for backwards
   * compatibility; pass `['wholesaler']` for "Dormant wholesalers" segments
   * or `['client', 'wholesaler']` for combined cohorts.
   */
  roles?: UserRole[];
}

/** Allowed operations per field. Used by both the API validator and the
 * in-memory eval to keep validation and logic in sync. */
export const FIELD_OPS: Record<SegmentField, SegmentOp[]> = {
  orderCount: ['gte', 'lte', 'eq'],
  totalSpent: ['gte', 'lte', 'eq'],
  lastOrderDays: ['gte', 'lte', 'eq'],
  city: ['eq', 'contains'],
};

/**
 * Pre-aggregates per-user order stats then filters in-memory by the supplied
 * rules. We can't fold all rule combinations into a single Prisma query because
 * the rules range across two relations (User → Order) and Prisma's aggregation
 * doesn't compose well with WHERE clauses on aggregates (no HAVING).
 *
 * 5k users with order counts is ~10ms to aggregate and ~1ms to filter — well
 * within an admin workflow's budget.
 */
// Short-lived cache for the raw segment scan. The query joins all users with
// all their orders — for ~100k users that's measured in seconds. The preview
// UI is interactive, so we share results across requests within 30s. Rules
// are evaluated per-request after the cache hit, so different rule sets
// still get the right output.
const SEGMENT_CACHE_TTL_MS = 30_000;
let segmentCache: { stats: unknown[]; expires: number } | null = null;

export interface RunSegmentOptions {
  /** Skip the in-memory cache. Export workflows must always re-read so a
   * fresh GDPR consent withdrawal / block flip removes the user from the
   * outgoing CSV — preview UI can still use cache for snappier filtering. */
  skipCache?: boolean;
}

export async function runSegment(input: SegmentInput, options: RunSegmentOptions = {}) {
  const now = new Date();
  const roles = input.roles && input.roles.length > 0 ? input.roles : (['client'] as UserRole[]);

  // Cache the (expensive) join by role set. Different rule combinations all
  // reuse the same cached scan within the TTL window.
  const cacheKey = roles.slice().sort().join(',');
  type StatRow = {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    role: UserRole;
    addresses: { city: string }[];
    orders: { totalAmount: unknown; createdAt: Date; status: string }[];
  };
  const cached = segmentCache as unknown as {
    key?: string;
    stats: StatRow[];
    expires: number;
  } | null;
  let stats: StatRow[];
  if (!options.skipCache && cached && cached.key === cacheKey && cached.expires > Date.now()) {
    stats = cached.stats;
  } else {
    // Exclude deleted + blocked users. Pre-fix scan picked them up and they
    // ended up in email/SMS blasts — GDPR/CAN-SPAM violation (writing to an
    // unsubscribed or deleted contact).
    stats = (await prisma.user.findMany({
      where: { role: { in: roles }, deletedAt: null, isBlocked: false },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        addresses: { select: { city: true }, take: 1 },
        orders: {
          select: { totalAmount: true, createdAt: true, status: true },
        },
      },
    })) as unknown as StatRow[];
    if (!options.skipCache) {
      segmentCache = {
        key: cacheKey,
        stats,
        expires: Date.now() + SEGMENT_CACHE_TTL_MS,
      } as unknown as typeof segmentCache;
    }
  }

  const matched = stats
    .map((u) => {
      // Exclude cancelled/returned from spend totals — refunded money isn't revenue.
      const valid = u.orders.filter((o) => o.status !== 'cancelled' && o.status !== 'returned');
      const orderCount = valid.length;
      const totalSpent = valid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const lastOrder = valid.reduce<Date | null>(
        (acc, o) => (!acc || o.createdAt > acc ? o.createdAt : acc),
        null,
      );
      const lastOrderDays = lastOrder
        ? Math.floor((now.getTime() - lastOrder.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const city = u.addresses[0]?.city ?? null;

      const passes = input.rules.every((r) =>
        evalRule(r, { orderCount, totalSpent, lastOrderDays, city }),
      );
      if (!passes) return null;
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        orderCount,
        totalSpent,
        lastOrderDays,
        city,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  const total = matched.length;
  const offset = Math.max(0, input.offset ?? 0);
  const sliced =
    typeof input.limit === 'number'
      ? matched.slice(offset, offset + input.limit)
      : matched.slice(offset);

  // computedAt lets the caller decide whether the snapshot is fresh enough for
  // a downstream email/SMS blast. Cron-driven refresh can compare against this.
  return { total, users: sliced, computedAt: now.toISOString() };
}

function compareStr(actual: string | null, op: SegmentOp, expected: string): boolean {
  if (actual === null) return false;
  // NFC-normalise both sides so a mixed-script "Київ" (Latin `i`) matches the
  // Cyrillic-only form stored on most user addresses.
  const a = actual.normalize('NFC').toLowerCase();
  const e = expected.normalize('NFC').toLowerCase();
  switch (op) {
    case 'eq':
      return a === e;
    case 'contains':
      return a.includes(e);
    default:
      return false;
  }
}

function compareNum(actual: number, op: SegmentOp, expected: number): boolean {
  switch (op) {
    case 'gte':
      return actual >= expected;
    case 'lte':
      return actual <= expected;
    case 'eq':
      return actual === expected;
    case 'contains':
      return false;
  }
}

function evalRule(
  r: SegmentRule,
  data: {
    orderCount: number;
    totalSpent: number;
    lastOrderDays: number | null;
    city: string | null;
  },
): boolean {
  switch (r.field) {
    case 'orderCount':
      return compareNum(data.orderCount, r.op, Number(r.value));
    case 'totalSpent':
      return compareNum(data.totalSpent, r.op, Number(r.value));
    case 'lastOrderDays':
      // "Не купував > N днів" — користувачі без жодного замовлення вважаються
      // "купував безкінечність днів тому" і теж пасують.
      if (data.lastOrderDays === null) return r.op === 'gte';
      return compareNum(data.lastOrderDays, r.op, Number(r.value));
    case 'city':
      return compareStr(data.city, r.op, String(r.value));
    default:
      return false;
  }
}
