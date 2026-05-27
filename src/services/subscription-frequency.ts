/**
 * Single source of truth for subscription frequency → days mapping.
 * Previously duplicated in `subscription.ts` and `jobs/process-subscriptions.ts`
 * — if one was edited (e.g. "monthly" 30 → 31 to match calendar months)
 * and the other forgot, customer-facing next-delivery dates drifted from
 * the cron's actual fire dates. Importing from one place keeps them
 * in lock-step.
 */
export const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
};

/** Compute the next delivery instant from a frequency code + a base date. */
export function nextDeliveryFrom(frequency: string, from: Date = new Date()): Date {
  const days = FREQUENCY_DAYS[frequency] ?? 30;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
