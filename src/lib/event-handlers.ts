import { on } from './event-bus';

// Register all domain event handlers
export function registerEventHandlers() {
  on('order.created', async (event) => {
    if (event.type !== 'order.created') return;
    const { orderId, userId } = event.payload;
    // Non-blocking: notify managers, update analytics
    try {
      const { notifyManagerNewOrder } = await import('@/services/telegram');
      // notification logic would go here
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
