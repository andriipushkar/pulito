import { useCallback } from 'react';

/**
 * Confirm-before-close guard for forms inside modals.
 *
 * Usage:
 *   const guard = useUnsavedChangesGuard(isDirty);
 *   onClose={() => guard(() => setOpen(false))}
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message = 'У вас є незбережені зміни. Закрити без збереження?',
) {
  return useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      if (typeof window !== 'undefined' && window.confirm(message)) {
        proceed();
      }
    },
    [isDirty, message],
  );
}
