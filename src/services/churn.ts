import { prisma } from '@/lib/prisma';

export interface ChurnEntry {
  userId: number;
  email: string;
  fullName: string;
  ltv: number;
  ordersCount: number;
  lastOrderAt: Date | null;
  daysSinceLastOrder: number;
  phone: string | null;
}

/**
 * "Churn radar" — customers with highest LTV who haven't ordered in N+ days.
 * Returns top 10 at-risk customers sorted by LTV descending.
 *
 * Ignores customers who never ordered (no signal to act on) and those who
 * ordered recently (= not at risk). Default window: 30+ days of silence.
 */
export async function getChurnRadar(opts: { minDaysSilent?: number; limit?: number } = {}) {
  const minDays = opts.minDaysSilent ?? 30;
  const limit = opts.limit ?? 10;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - minDays);

  // Aggregate LTV + last order per user from non-cancelled orders.
  const rows = await prisma.$queryRaw<
    {
      userId: number;
      email: string;
      fullName: string;
      phone: string | null;
      ltv: number;
      ordersCount: number;
      lastOrderAt: Date;
    }[]
  >`
    SELECT
      u.id            AS "userId",
      u.email         AS email,
      u.full_name     AS "fullName",
      u.phone         AS phone,
      SUM(o.total_amount)::float AS ltv,
      COUNT(o.id)::int           AS "ordersCount",
      MAX(o.created_at)          AS "lastOrderAt"
    FROM users u
    JOIN orders o ON o.user_id = u.id
    WHERE o.status NOT IN ('cancelled', 'returned')
      AND u.is_blocked = false
    GROUP BY u.id, u.email, u.full_name, u.phone
    HAVING MAX(o.created_at) < ${cutoff}
       AND SUM(o.total_amount) > 0
    ORDER BY SUM(o.total_amount) DESC
    LIMIT ${limit}
  `;

  const now = Date.now();
  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    fullName: r.fullName,
    phone: r.phone,
    ltv: Number(r.ltv) || 0,
    ordersCount: r.ordersCount,
    lastOrderAt: r.lastOrderAt,
    daysSinceLastOrder: Math.floor(
      (now - new Date(r.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  })) as ChurnEntry[];
}
