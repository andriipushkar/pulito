import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    // Redis-backed rate limit so the cap holds across PM2 cluster workers /
    // server restarts (the previous in-memory Map reset on every deploy,
    // letting a stolen session probe 5×N keys instead of 5).
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse(`Забагато тестових запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const { provider, config } = await request.json();

    // Audit every test attempt so a compromised session leaves a trail even
    // when the test "succeeds". Includes provider and admin id; we don't log
    // credentials (those go in the encrypted store, not the audit log).
    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'payment_test',
      details: { provider, hasCredentials: Boolean(config) },
      ipAddress: getClientIp(request),
    }).catch((err) => {
      logger.warn('[payment-test] audit log failed (non-fatal)', { error: String(err) });
    });

    if (provider === 'liqpay') {
      if (!config.publicKey || !config.privateKey) {
        return successResponse({ success: false, error: "Public Key та Private Key обов'язкові" });
      }
      // LiqPay test: create a test checkout request
      const crypto = await import('crypto');
      const testData = Buffer.from(
        JSON.stringify({
          version: 3,
          public_key: config.publicKey,
          action: 'status',
          order_id: 'test_connection_check',
        }),
      ).toString('base64');
      const signature = crypto
        .createHash('sha1')
        .update(config.privateKey + testData + config.privateKey)
        .digest('base64');

      const res = await fetch('https://www.liqpay.ua/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(testData)}&signature=${encodeURIComponent(signature)}`,
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.result === 'error' && data.err_code === 'order_not_found') {
        // This is actually a success — means credentials are valid
        return successResponse({
          success: true,
          name: `LiqPay (${config.publicKey.slice(0, 10)}...)`,
        });
      }
      if (data.result === 'error') {
        return successResponse({ success: false, error: data.err_description || data.err_code });
      }
      return successResponse({ success: true, name: 'LiqPay' });
    }

    if (provider === 'monobank') {
      if (!config.token) {
        return successResponse({ success: false, error: "API Token обов'язковий" });
      }
      const res = await fetch('https://api.monobank.ua/api/merchant/details', {
        headers: { 'X-Token': config.token },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        return successResponse({ success: true, name: `Monobank: ${data.merchantName || 'OK'}` });
      }
      return successResponse({ success: false, error: `HTTP ${res.status}: Невірний токен` });
    }

    if (provider === 'wayforpay') {
      if (!config.merchantAccount || !config.secretKey) {
        return successResponse({
          success: false,
          error: "Merchant Account та Secret Key обов'язкові",
        });
      }
      // Real probe: CHECK_STATUS for a bogus order, signed with the entered
      // creds. Valid creds → WayForPay processes the request (e.g. "transaction
      // not found"); a wrong secret/merchant → reasonCode 1113 "Invalid
      // signature" (or 1114). This actually validates the secret key — unlike a
      // length check, which gave false confidence.
      const cryptoMod = await import('crypto');
      const orderReference = 'test_connection_check';
      const signature = cryptoMod
        .createHmac('md5', config.secretKey)
        .update([config.merchantAccount, orderReference].join(';'))
        .digest('hex');
      const res = await fetch('https://api.wayforpay.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'CHECK_STATUS',
          merchantAccount: config.merchantAccount,
          orderReference,
          apiVersion: 1,
          merchantSignature: signature,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.reasonCode === 1113 || data.reasonCode === 1114) {
        return successResponse({
          success: false,
          error: `Невірні ключі (${data.reason || data.reasonCode})`,
        });
      }
      return successResponse({ success: true, name: `WayForPay: ${config.merchantAccount}` });
    }

    return successResponse({ success: false, error: 'Невідомий провайдер' });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Помилка з'єднання";
    return successResponse({ success: false, error: message });
  }
});
