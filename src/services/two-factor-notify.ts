import { sendEmail } from './email';
import { escapeHtml } from '@/utils/format';
import { logger } from '@/lib/logger';

/**
 * Email the account owner when 2FA is turned on or off. This is a security
 * signal they should see even if they didn't initiate it (account takeover).
 * Best-effort: never throws, so an SMTP outage can't break the 2FA flow.
 */
export async function notifyTwoFactorChange(
  email: string | undefined,
  enabled: boolean,
): Promise<void> {
  if (!email) return;

  const subject = enabled
    ? 'Двофакторну автентифікацію увімкнено'
    : 'Двофакторну автентифікацію вимкнено';
  const action = enabled ? 'увімкнено' : 'вимкнено';
  const warning = enabled
    ? 'Якщо це були не ви — негайно змініть пароль і зверніться до підтримки.'
    : 'Якщо це були не ви, ваш акаунт міг бути скомпрометований: негайно змініть пароль, увімкніть 2FA знову та зверніться до підтримки.';

  try {
    await sendEmail({
      to: email,
      subject,
      html:
        `<p>На вашому акаунті <strong>${escapeHtml(email)}</strong> щойно <strong>${action}</strong> ` +
        `двофакторну автентифікацію.</p><p>${warning}</p>`,
    });
  } catch (err) {
    logger.warn('[2fa] status-change notification email failed', { error: String(err) });
  }
}
