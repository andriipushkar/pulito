import { on } from './event-bus';

// Register all domain event handlers
export function registerEventHandlers() {
  on('order.created', async (event) => {
    if (event.type !== 'order.created') return;
    // Non-blocking: notify managers, update analytics.
    // Hook is intentionally empty — notification wiring lives in the cron job
    // pipeline; event here reserves a seam for future side effects.
    try {
      await import('@/services/telegram');
    } catch {}
  });

  on('order.completed', async (event) => {
    if (event.type !== 'order.completed') return;
    const { userId } = event.payload;
    try {
      const { updateStreakOnOrder } = await import('@/services/jobs/loyalty-streaks');
      await updateStreakOnOrder(userId);
    } catch {}
  });

  on('product.stock_changed', async (event) => {
    if (event.type !== 'product.stock_changed') return;
    // Could trigger: marketplace sync, low-stock alerts, etc.
  });

  on('user.registered', async (event) => {
    if (event.type !== 'user.registered') return;
    // Could trigger: welcome email, analytics event, etc.
  });
}
