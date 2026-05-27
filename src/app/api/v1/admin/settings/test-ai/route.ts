import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole2fa } from '@/middleware/auth';
import { getSettings } from '@/services/settings';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const schema = z.object({
  provider: z.enum(['claude', 'gemini']),
  // Optional override. If absent or masked (••••), the saved key from DB / env is used.
  apiKey: z.string().max(500).optional(),
  // Optional Gemini model override for the test.
  model: z.string().max(100).optional(),
});

function isMasked(v: string | undefined): boolean {
  return !!v && /^•+/.test(v);
}

async function testClaude(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200) || 'no body'}` };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

async function testGemini(
  apiKey: string,
  model: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200) || 'no body'}` };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 200) };
  }
}

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    // Each call burns Claude/Gemini tokens — stuck UI button or stolen
    // session shouldn't drain the API budget. 5/min matches the SMTP/payment
    // test bucket (same risk profile: credential probe + cost).
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse(`Забагато перевірок. Зачекайте ${rl.retryAfter}с.`, 429);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Audit: external API probe with admin-controlled key — same forensic
    // category as channel-settings/test (was the admin testing a stolen key?).
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'ai_test',
      details: {
        action: 'test',
        provider: parsed.data.provider,
        usedOverrideKey: !!parsed.data.apiKey && !/^•+/.test(parsed.data.apiKey),
      },
      ipAddress: getClientIp(request),
    });

    const settings = await getSettings();

    if (parsed.data.provider === 'claude') {
      // Use admin-provided key unless it's the masked placeholder.
      const key =
        parsed.data.apiKey && !isMasked(parsed.data.apiKey)
          ? parsed.data.apiKey
          : settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '';
      if (!key) return errorResponse('Ключ Claude не задано', 400);
      const result = await testClaude(key);
      if (result.ok) return successResponse({ ok: true });
      return errorResponse(`Claude: ${result.error}`, 400);
    }

    // Gemini
    const key =
      parsed.data.apiKey && !isMasked(parsed.data.apiKey)
        ? parsed.data.apiKey
        : settings.gemini_api_key || process.env.GEMINI_API_KEY || '';
    if (!key) return errorResponse('Ключ Gemini не задано', 400);
    const model =
      parsed.data.model || settings.gemini_model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await testGemini(key, model);
    if (result.ok) return successResponse({ ok: true });
    return errorResponse(`Gemini: ${result.error}`, 400);
  } catch (err) {
    logger.error('[admin/settings/test-ai] failed', { error: err });
    return errorResponse('Помилка перевірки', 500);
  }
});
