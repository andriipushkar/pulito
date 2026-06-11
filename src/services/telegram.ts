import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import { isValidGtin } from '@/utils/gtin';
import { findAutoReply } from './bot-auto-reply';
import { pickWelcomeMessage } from './bot-welcome';
import { getTelegramCreds } from './channel-config';

// Telegram parses our messages with parse_mode: HTML — any `<`, `>`, `&` from
// user-supplied fields (name, phone, email, order comment) must be escaped or
// the whole message is rejected with HTTP 400 and the manager never sees the
// notification. Mirror the standard React escaping rules.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Credentials are resolved per-call via getTelegramCreds() (DB-first, env
// fallback) so the admin panel drives the bot. Helper builds the API base for
// a freshly-resolved token.
const apiBaseFor = (botToken: string) => `https://api.telegram.org/bot${botToken}`;

// UTM query string for outbound links from the Telegram bot. Campaign names
// match the bot handler that emitted the link, so /admin/analytics → UTM
// Campaign view shows which bot flow drove each purchase.
function botUtm(campaign: string): string {
  return `utm_source=telegram&utm_medium=bot&utm_campaign=${campaign}`;
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string; last_name?: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
  date: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number; first_name: string };
  message?: TelegramMessage;
  data?: string;
}

interface TelegramInlineQuery {
  id: string;
  from: { id: number; first_name: string };
  query: string;
  offset: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: TelegramInlineQuery;
}

/**
 * Unlink a blocked user's Telegram chat so we stop sending messages.
 */
async function handleBotBlocked(chatId: number) {
  try {
    await prisma.user.updateMany({
      where: { telegramChatId: BigInt(chatId) },
      data: { telegramChatId: null },
    });
    logger.info(`Telegram bot blocked by chat ${chatId} — unlinked`);
  } catch {
    // best-effort cleanup
  }
}

function parseAutoReplyButtons(
  buttons: unknown,
): Array<Array<{ text: string; url?: string; callback_data?: string }>> | null {
  if (!Array.isArray(buttons)) return null;
  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
  for (const row of buttons) {
    if (!Array.isArray(row)) continue;
    const cells: Array<{ text: string; url?: string; callback_data?: string }> = [];
    for (const cell of row) {
      if (!cell || typeof cell !== 'object') continue;
      const c = cell as Record<string, unknown>;
      if (typeof c.text !== 'string') continue;
      const out: { text: string; url?: string; callback_data?: string } = { text: c.text };
      if (typeof c.url === 'string') out.url = c.url;
      else if (typeof c.callback_data === 'string') out.callback_data = c.callback_data;
      cells.push(out);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows.length > 0 ? rows : null;
}

// Telegram hard limits (after entity parsing): 4096 chars for message text,
// 1024 for a photo caption. Over-limit calls are rejected with HTTP 400 and the
// message is silently lost — so clamp before sending. Names are escaped and HTML
// tags sit at the start, so trimming the tail keeps valid HTML.
const TG_TEXT_LIMIT = 4096;
const TG_CAPTION_LIMIT = 1024;

function clampText(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit - 1) + '…';
}

/**
 * POST a Telegram method with one retry that honours `retry_after` on HTTP 429
 * (flood control). Returns the Response so callers can branch on status.
 */
async function tgPost(method: string, body: Record<string, unknown>): Promise<Response> {
  const { botToken } = await getTelegramCreds();
  // No token configured (neither admin panel nor env) — skip the network call
  // and return a benign non-2xx so callers branch as "not sent" without firing
  // a request to https://api.telegram.org/bot/… (which would 404).
  if (!botToken) return new Response('{"ok":false}', { status: 400 });

  const apiBase = apiBaseFor(botToken);
  const send = () =>
    fetch(`${apiBase}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 429) {
    const data = await res
      .clone()
      .json()
      .catch(() => null);
    const retryAfter = (data as { parameters?: { retry_after?: number } } | null)?.parameters
      ?.retry_after;
    // Respect the back-off but cap it so a request handler never blocks long.
    await new Promise((r) => setTimeout(r, Math.min((retryAfter ?? 1) * 1000, 5000)));
    res = await send();
  }
  return res;
}

async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: string;
    reply_markup?: unknown;
  },
) {
  const res = await tgPost('sendMessage', {
    chat_id: chatId,
    text: clampText(text, TG_TEXT_LIMIT),
    parse_mode: options?.parse_mode || 'HTML',
    reply_markup: options?.reply_markup,
  });

  if (res.status === 403) {
    await handleBotBlocked(chatId);
  }
}

async function sendPhoto(
  chatId: number,
  photoUrl: string,
  caption: string,
  options?: {
    parse_mode?: string;
    reply_markup?: unknown;
  },
) {
  const res = await tgPost('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: clampText(caption, TG_CAPTION_LIMIT),
    parse_mode: options?.parse_mode || 'HTML',
    reply_markup: options?.reply_markup,
  });

  if (res.status === 403) {
    await handleBotBlocked(chatId);
  }
}

/**
 * Send a product message: uses sendPhoto if image exists, otherwise sendMessage.
 */
async function sendProductMessage(
  chatId: number,
  text: string,
  imageUrl: string | null,
  options?: {
    parse_mode?: string;
    reply_markup?: unknown;
  },
) {
  if (imageUrl) {
    await sendPhoto(chatId, imageUrl, text, options);
  } else {
    await sendMessage(chatId, text, options);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const { botToken } = await getTelegramCreds();
  if (!botToken) return;
  await fetch(`${apiBaseFor(botToken)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// Find user linked to this telegram chat
async function findLinkedUser(chatId: number) {
  return prisma.user.findFirst({
    where: { telegramChatId: BigInt(chatId) },
    select: { id: true, fullName: true, role: true, email: true },
  });
}

const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: '🛒 Каталог', callback_data: 'catalog' },
      { text: '🔥 Акції', callback_data: 'promo' },
    ],
    [
      { text: '🆕 Новинки', callback_data: 'new' },
      { text: '⭐ Популярне', callback_data: 'popular' },
    ],
    [
      { text: '📦 Мої замовлення', callback_data: 'orders' },
      { text: '✍️ Відгук', callback_data: 'feedback' },
    ],
    [
      { text: "📞 Зв'язатися", callback_data: 'contact' },
      { text: '⚙️ Налаштування', callback_data: 'settings' },
    ],
  ],
};

async function handleStart(chatId: number, firstName: string) {
  const user = await findLinkedUser(chatId);

  // Returning users always see the standard greeting; new chats get an
  // A/B-tested welcome (if any are configured) before the menu.
  if (!user) {
    const welcome = await pickWelcomeMessage('telegram');
    if (welcome) {
      const personalised = welcome.messageText.replace(/\{name\}/g, firstName);
      const inline = parseAutoReplyButtons(welcome.buttons);
      await sendMessage(chatId, personalised, {
        ...(inline ? { reply_markup: { inline_keyboard: inline } } : {}),
      });
    }
  }

  const greeting = user
    ? `Вітаємо, ${user.fullName || firstName}! 👋`
    : `Вітаємо у Pulito Trade, ${firstName}! 👋`;

  await sendMessage(chatId, `${greeting}\n\nОберіть дію:`, {
    reply_markup: MAIN_MENU,
  });
}

async function handleCatalog(chatId: number) {
  const categories = await prisma.category.findMany({
    where: { isVisible: true, parentId: null },
    select: { id: true, name: true, slug: true },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });

  if (categories.length === 0) {
    await sendMessage(chatId, 'Каталог порожній.');
    return;
  }

  const keyboard = categories.map((c) => [{ text: c.name, callback_data: `cat_${c.id}` }]);
  keyboard.push([{ text: '⬅️ Головне меню', callback_data: 'menu' }]);

  await sendMessage(chatId, '📂 Оберіть категорію:', {
    reply_markup: { inline_keyboard: keyboard },
  });
}

const PRODUCTS_PER_PAGE = 5;

async function handleCategoryProducts(chatId: number, categoryId: number, offset: number = 0) {
  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
        priceRetail: true,
        isPromo: true,
        code: true,
        imagePath: true,
      },
      orderBy: { sortOrder: 'asc' },
      skip: offset,
      take: PRODUCTS_PER_PAGE,
    }),
    prisma.product.count({ where: { isActive: true, categoryId } }),
  ]);

  if (products.length === 0 && offset === 0) {
    await sendMessage(chatId, 'У цій категорії поки немає товарів.');
    return;
  }

  if (products.length === 0) {
    await sendMessage(chatId, 'Більше товарів немає.');
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const page = Math.floor(offset / PRODUCTS_PER_PAGE) + 1;
  const totalPages = Math.ceil(totalCount / PRODUCTS_PER_PAGE);
  await sendMessage(chatId, `📂 Товари категорії (стор. ${page}/${totalPages}):`);

  for (const p of products) {
    const badge = p.isPromo ? '🔥 ' : '';
    const text = `${badge}<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛒 На сайт',
              url: `${appUrl}/product/${p.slug}?${botUtm('category_browse')}`,
            },
          ],
        ],
      },
    });
  }

  // Pagination buttons
  const paginationButtons: { text: string; callback_data: string }[] = [];
  if (offset > 0) {
    paginationButtons.push({
      text: '◀️ Назад',
      callback_data: `cat_products:${categoryId}:${offset - PRODUCTS_PER_PAGE}`,
    });
  }
  if (offset + PRODUCTS_PER_PAGE < totalCount) {
    paginationButtons.push({
      text: 'Вперед ▶️',
      callback_data: `cat_products:${categoryId}:${offset + PRODUCTS_PER_PAGE}`,
    });
  }

  if (paginationButtons.length > 0) {
    await sendMessage(chatId, 'Навігація:', {
      reply_markup: {
        inline_keyboard: [paginationButtons, [{ text: '⬅️ Головне меню', callback_data: 'menu' }]],
      },
    });
  }
}

async function handlePromo(chatId: number, offset: number = 0) {
  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isPromo: true },
      select: {
        id: true,
        name: true,
        slug: true,
        priceRetail: true,
        priceRetailOld: true,
        code: true,
        imagePath: true,
      },
      skip: offset,
      take: PRODUCTS_PER_PAGE,
    }),
    prisma.product.count({ where: { isActive: true, isPromo: true } }),
  ]);

  if (products.length === 0 && offset === 0) {
    await sendMessage(chatId, 'Наразі немає активних акцій.');
    return;
  }

  if (products.length === 0) {
    await sendMessage(chatId, 'Більше акційних товарів немає.');
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const page = Math.floor(offset / PRODUCTS_PER_PAGE) + 1;
  const totalPages = Math.ceil(totalCount / PRODUCTS_PER_PAGE);
  await sendMessage(chatId, `🔥 <b>Акційні товари</b> (стор. ${page}/${totalPages}):`);

  for (const p of products) {
    const oldPrice = p.priceRetailOld ? `<s>${Number(p.priceRetailOld).toFixed(2)} ₴</s> → ` : '';
    const text = `<b>${escapeHtml(p.name)}</b>\n${oldPrice}<b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Купити', url: `${appUrl}/product/${p.slug}?${botUtm('promo')}` }],
        ],
      },
    });
  }

  // Pagination buttons
  const paginationButtons: { text: string; callback_data: string }[] = [];
  if (offset > 0) {
    paginationButtons.push({
      text: '◀️ Назад',
      callback_data: `promo:${offset - PRODUCTS_PER_PAGE}`,
    });
  }
  if (offset + PRODUCTS_PER_PAGE < totalCount) {
    paginationButtons.push({
      text: 'Вперед ▶️',
      callback_data: `promo:${offset + PRODUCTS_PER_PAGE}`,
    });
  }

  if (paginationButtons.length > 0) {
    await sendMessage(chatId, 'Навігація:', {
      reply_markup: {
        inline_keyboard: [paginationButtons, [{ text: '⬅️ Головне меню', callback_data: 'menu' }]],
      },
    });
  }
}

async function handleOrders(chatId: number) {
  const user = await findLinkedUser(chatId);
  if (!user) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await sendMessage(chatId, "Для перегляду замовлень прив'яжіть акаунт:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Увійти в акаунт', url: `${appUrl}/auth/login?telegram=${chatId}` }],
        ],
      },
    });
    return;
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (orders.length === 0) {
    await sendMessage(chatId, 'У вас ще немає замовлень.');
    return;
  }

  const statusEmoji: Record<string, string> = {
    new_order: '🆕',
    processing: '⏳',
    confirmed: '✅',
    paid: '💰',
    shipped: '🚚',
    completed: '✅',
    cancelled: '❌',
    returned: '↩️',
  };

  let text = '📦 <b>Ваші замовлення:</b>\n\n';
  for (const o of orders) {
    const emoji = statusEmoji[o.status] || '📦';
    const date = new Date(o.createdAt).toLocaleDateString('uk-UA');
    text += `${emoji} #${o.orderNumber} — ${Number(o.totalAmount).toFixed(2)} ₴ (${date})\n`;
  }

  await sendMessage(chatId, text);
}

/**
 * /barcode <EAN> — quick lookup for warehouse workers. Searches by barcode
 * first (exact match), falls back to variant SKU, then plain text search.
 * Replies with name, code, stock and price — what a packer needs to
 * confirm they grabbed the right item.
 */
async function handleBarcodeLookup(chatId: number, rawCode: string) {
  const digits = rawCode.replace(/\D/g, '');
  if (!digits) {
    await sendMessage(chatId, 'Вкажіть штрихкод: <code>/barcode 4823033008007</code>');
    return;
  }
  if (!isValidGtin(digits)) {
    await sendMessage(
      chatId,
      `⚠️ <b>${digits}</b> — невалідна контрольна цифра (GS1). Перевірте останню цифру.`,
    );
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // 1. Try product by barcode
  const product = await prisma.product.findUnique({
    where: { barcode: digits },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      priceWholesale: true,
      quantity: true,
      imagePath: true,
      isActive: true,
    },
  });

  if (product) {
    const stockIcon = product.quantity === 0 ? '❌' : product.quantity <= 5 ? '⚠️' : '✅';
    const text = [
      `<b>${escapeHtml(product.name)}</b>`,
      `Код: <code>${escapeHtml(product.code)}</code>`,
      `Штрихкод: <code>${digits}</code>`,
      `Залишок: ${stockIcon} <b>${product.quantity}</b> шт`,
      `Ціна: <b>${Number(product.priceRetail).toFixed(2)} ₴</b>` +
        (product.priceWholesale ? ` (опт ${Number(product.priceWholesale).toFixed(2)} ₴)` : ''),
      product.isActive ? '' : '⚠️ <i>Товар деактивовано</i>',
    ]
      .filter(Boolean)
      .join('\n');
    const imageUrl = product.imagePath ? `${appUrl}${product.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Відкрити на сайті', url: `${appUrl}/product/${product.slug}` }],
        ],
      },
    });
    return;
  }

  // 2. Try variant by barcode
  const variant = await prisma.productVariant.findUnique({
    where: { barcode: digits },
    select: {
      sku: true,
      name: true,
      quantity: true,
      priceRetail: true,
      product: { select: { name: true, slug: true, code: true } },
    },
  });

  if (variant) {
    const stockIcon = variant.quantity === 0 ? '❌' : variant.quantity <= 5 ? '⚠️' : '✅';
    const text = [
      `<b>${escapeHtml(variant.product.name)}</b>`,
      `Варіант: <b>${escapeHtml(variant.name)}</b>`,
      `SKU: <code>${escapeHtml(variant.sku)}</code>`,
      `Штрихкод: <code>${digits}</code>`,
      `Залишок: ${stockIcon} <b>${variant.quantity}</b> шт`,
      variant.priceRetail
        ? `Ціна варіанта: <b>${Number(variant.priceRetail).toFixed(2)} ₴</b>`
        : 'Ціна: за основним товаром',
    ].join('\n');
    await sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Відкрити товар', url: `${appUrl}/product/${variant.product.slug}` }],
        ],
      },
    });
    return;
  }

  await sendMessage(
    chatId,
    `Не знайдено товар зі штрихкодом <code>${digits}</code>.\n\nЯкщо це новий товар — додайте його в адмінці.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: '🔍 Пошук за назвою', callback_data: 'search' }]],
      },
    },
  );
}

async function handleSearch(chatId: number, query: string) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { name: true, slug: true, priceRetail: true, code: true, imagePath: true },
    take: 5,
  });

  if (products.length === 0) {
    await sendMessage(
      chatId,
      `На жаль, за запитом «${escapeHtml(query)}» нічого не знайдено.\nСпробуйте інший запит або перегляньте каталог.`,
      {
        reply_markup: { inline_keyboard: [[{ text: '🛒 Каталог', callback_data: 'catalog' }]] },
      },
    );
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  await sendMessage(chatId, `🔍 Результати пошуку «${escapeHtml(query)}»:`);
  for (const p of products) {
    const text = `<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: ${Number(p.priceRetail).toFixed(2)} ₴`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?${botUtm('search')}` }],
        ],
      },
    });
  }
}

async function handleNew(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      priceRetail: true,
      code: true,
      imagePath: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: PRODUCTS_PER_PAGE,
  });

  if (products.length === 0) {
    await sendMessage(chatId, 'Наразі немає нових товарів.');
    return;
  }

  await sendMessage(chatId, '🆕 <b>Новинки:</b>');
  for (const p of products) {
    const date = new Date(p.createdAt).toLocaleDateString('uk-UA');
    const text = `<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>\nДодано: ${date}`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?${botUtm('new_arrivals')}` }],
        ],
      },
    });
  }
}

async function handlePopular(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      priceRetail: true,
      code: true,
      imagePath: true,
      ordersCount: true,
    },
    orderBy: { ordersCount: 'desc' },
    take: PRODUCTS_PER_PAGE,
  });

  if (products.length === 0) {
    await sendMessage(chatId, 'Наразі немає популярних товарів.');
    return;
  }

  await sendMessage(chatId, '⭐ <b>Популярні товари:</b>');
  for (const p of products) {
    const text = `<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?${botUtm('popular')}` }],
        ],
      },
    });
  }
}

// Track users awaiting feedback text input. Stored in Redis so multiple
// worker processes (PM2 cluster, multiple pods) share the same flag — the
// previous in-memory Set would silently desync between workers.
const FEEDBACK_TTL_SECONDS = 60 * 30;
const feedbackKey = (chatId: number) => `tg:feedback:${chatId}`;
const feedbackAwaiters = {
  async has(chatId: number): Promise<boolean> {
    try {
      return (await redis.exists(feedbackKey(chatId))) === 1;
    } catch {
      return false;
    }
  },
  async add(chatId: number): Promise<void> {
    try {
      await redis.set(feedbackKey(chatId), '1', 'EX', FEEDBACK_TTL_SECONDS);
    } catch {
      // Redis down — feedback flow will just fall back to default reply.
    }
  },
  async delete(chatId: number): Promise<void> {
    try {
      await redis.del(feedbackKey(chatId));
    } catch {
      // ignored
    }
  },
};

async function handleFeedbackStart(chatId: number) {
  await feedbackAwaiters.add(chatId);
  await sendMessage(
    chatId,
    '✍️ Напишіть ваш відгук або побажання одним повідомленням.\n\nДля скасування натисніть /cancel',
  );
}

async function handleFeedbackSubmit(chatId: number, message: string, firstName: string) {
  await feedbackAwaiters.delete(chatId);

  const user = await findLinkedUser(chatId);
  const name = user?.fullName || firstName;
  const email = user?.email || undefined;

  await prisma.feedback.create({
    data: {
      name,
      email,
      subject: 'Відгук з Telegram-бота',
      message,
      type: 'form',
    },
  });

  await sendMessage(chatId, "✅ Дякуємо за ваш відгук! Ми обов'язково його розглянемо.", {
    reply_markup: { inline_keyboard: [[{ text: '⬅️ Головне меню', callback_data: 'menu' }]] },
  });

  // Notify manager about new feedback
  await notifyManagerFeedback({
    type: 'form',
    name,
    email,
    message,
    subject: 'Відгук з Telegram-бота',
  });
}

async function handleSettings(chatId: number) {
  const user = await findLinkedUser(chatId);
  if (!user) {
    await sendMessage(chatId, "⚠️ Для налаштувань потрібно прив'язати акаунт.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Прив'язати акаунт", callback_data: 'link' }],
          [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
        ],
      },
    });
    return;
  }

  // Read current notification preferences
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const notifPrefs = (fullUser?.notificationPrefs as { telegram?: boolean } | null) || {};
  const telegramEnabled = notifPrefs.telegram !== false; // default true

  const toggleText = telegramEnabled
    ? '🔕 Вимкнути Telegram-сповіщення'
    : '🔔 Увімкнути Telegram-сповіщення';
  const toggleAction = telegramEnabled ? 'settings_notif:off' : 'settings_notif:on';

  await sendMessage(
    chatId,
    `⚙️ <b>Налаштування</b>\n\nTelegram-сповіщення: ${telegramEnabled ? '✅ Увімкнено' : '❌ Вимкнено'}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: toggleText, callback_data: toggleAction }],
          [{ text: "🔗 Прив'язка акаунту", callback_data: 'link' }],
          [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
        ],
      },
    },
  );
}

async function handleSettingsToggleNotification(chatId: number, enable: boolean) {
  const user = await findLinkedUser(chatId);
  if (!user) return;

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });
  const currentPrefs = (fullUser?.notificationPrefs as Record<string, unknown> | null) || {};

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notificationPrefs: { ...currentPrefs, telegram: enable },
    },
  });

  const statusText = enable
    ? '✅ Telegram-сповіщення увімкнено.'
    : '❌ Telegram-сповіщення вимкнено.';
  await sendMessage(chatId, statusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚙️ Назад до налаштувань', callback_data: 'settings' }],
        [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
      ],
    },
  });
}

async function handleContact(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  await sendMessage(
    chatId,
    `📞 <b>Контакти Pulito Trade</b>\n\n📱 Телефон: +380 XX XXX XX XX\n📧 Email: info@pulito.trade\n🕐 Графік: Пн-Пт 9:00-18:00\n🌐 Сайт: ${appUrl}`,
  );
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    `<b>Доступні команди:</b>\n\n/start — Головне меню\n/catalog — Каталог товарів\n/promo — Акційні товари\n/new — Новинки\n/popular — Популярні товари\n/search — Пошук товарів\n/barcode &lt;EAN&gt; — Пошук за штрихкодом\n/orders — Мої замовлення\n/feedback — Залишити відгук\n/settings — Налаштування сповіщень\n/contact — Контакти\n/help — Ця довідка\n\n💡 Просто пришліть 8-14 цифр — бот сам розпізнає штрихкод. Або напишіть назву товару для пошуку.`,
  );
}

const STATUS_LABELS: Record<string, string> = {
  new_order: 'Нове замовлення',
  processing: 'В обробці',
  confirmed: 'Підтверджено',
  paid: 'Оплачено',
  shipped: 'Відправлено',
  completed: 'Завершено',
  cancelled: 'Скасовано',
  returned: 'Повернено',
};

/**
 * Send a generic notification to a Telegram user by chatId.
 * Used by the notification queue for non-order events (promo, system, etc.).
 */
export async function sendClientNotification(
  chatId: number,
  title: string,
  message: string,
  link?: string | null,
) {
  const { botToken } = await getTelegramCreds();
  if (!botToken) return;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`;

  const replyMarkup = link
    ? { inline_keyboard: [[{ text: '📋 Переглянути', url: `${appUrl}${link}` }]] }
    : undefined;

  await sendMessage(chatId, text, { reply_markup: replyMarkup });
}

/**
 * Send a product photo to a user via Telegram.
 * Looks up the user's telegramChatId and sends the image with caption.
 */
export async function sendProductPhotoToUser(
  userId: number,
  imageUrl: string,
  caption: string,
): Promise<boolean> {
  const { botToken } = await getTelegramCreds();
  if (!botToken) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });

  if (!user?.telegramChatId) return false;

  const chatId = Number(user.telegramChatId);
  try {
    // Caption is plain text (product name + admin's free-text message) sent
    // with parse_mode HTML — escape it or a stray `<`/`&` kills the send.
    await sendPhoto(chatId, imageUrl, escapeHtml(caption));
    return true;
  } catch {
    return false;
  }
}

/**
 * Notify manager about a new order via Telegram.
 */
export async function notifyManagerNewOrder(order: {
  id?: number;
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  totalAmount: number | { toString(): string };
  itemsCount: number;
  clientType: string;
  deliveryMethod: string;
  paymentMethod: string;
}) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken) return;

  const clientLabel = order.clientType === 'wholesale' ? 'Гуртовий' : 'Роздрібний';
  const text = [
    `🆕 <b>Нове замовлення #${escapeHtml(order.orderNumber)}</b>`,
    '',
    `👤 ${escapeHtml(order.contactName)}`,
    `📱 ${escapeHtml(order.contactPhone)}`,
    order.contactEmail ? `📧 ${escapeHtml(order.contactEmail)}` : '',
    '',
    `💰 Сума: <b>${Number(order.totalAmount).toFixed(2)} ₴</b>`,
    `📦 Товарів: ${order.itemsCount}`,
    `🏷 Тип: ${escapeHtml(clientLabel)}`,
    `🚚 Доставка: ${escapeHtml(order.deliveryMethod)}`,
    `💳 Оплата: ${escapeHtml(order.paymentMethod)}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Inline "Open in admin" + "Call client" buttons so the manager reacts in
  // one tap instead of switching to the browser/dialer manually.
  const appUrl = process.env.APP_URL;
  const buttons: Array<Array<{ text: string; url: string }>> = [];
  if (appUrl && order.id) {
    buttons.push([{ text: '🔗 Відкрити замовлення', url: `${appUrl}/admin/orders/${order.id}` }]);
  }
  if (order.contactPhone) {
    const phoneDigits = order.contactPhone.replace(/[^\d+]/g, '');
    buttons.push([{ text: '📞 Подзвонити', url: `tel:${phoneDigits}` }]);
  }
  const replyMarkup = buttons.length > 0 ? { inline_keyboard: buttons } : undefined;

  try {
    await sendMessage(Number(chatId), text, { reply_markup: replyMarkup });
  } catch {
    // Don't fail order creation if notification fails
  }
}

/**
 * Notify manager about products dropping below safety stock threshold.
 * No-op if Telegram is not configured.
 */
export async function notifyManagerLowStock(
  products: { id: number; code: string; name: string; quantity: number }[],
) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken || products.length === 0) return;

  const lines = [
    `📉 <b>Низький залишок (${products.length} ${products.length === 1 ? 'товар' : 'товарів'})</b>`,
    '',
    ...products
      .slice(0, 20)
      .map(
        (p) =>
          `• <b>${escapeHtml(p.code)}</b> ${escapeHtml(p.name.slice(0, 50))} — <b>${p.quantity}</b> шт.`,
      ),
  ];
  if (products.length > 20) lines.push(`...та ще ${products.length - 20}`);
  lines.push('', `${process.env.APP_URL || ''}/admin/products?lowStock=1`);

  try {
    await sendMessage(Number(chatId), lines.join('\n'));
  } catch {
    // Best-effort
  }
}

/**
 * Notify manager about new marketplace messages from buyers. Fires once per
 * sync run with the aggregate total + per-platform breakdown so the manager
 * gets one ping every ~15 minutes (sync cadence) instead of N pings.
 */
export async function notifyManagerMarketplaceMessages(args: {
  total: number;
  perPlatform: Record<string, number>;
}) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken || args.total === 0) return;

  const platformLabels: Record<string, string> = {
    olx: 'OLX',
    rozetka: 'Rozetka',
    prom: 'Prom.ua',
    epicentrk: 'Epicentr',
  };
  const breakdown = Object.entries(args.perPlatform)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${platformLabels[p] || p}: <b>${n}</b>`)
    .join('\n');

  const text = [
    `💬 <b>${args.total} ${args.total === 1 ? 'нове повідомлення' : 'нових повідомлень'} з маркетплейсів</b>`,
    '',
    breakdown,
  ].join('\n');

  const appUrl = process.env.APP_URL;
  const buttons: Array<Array<{ text: string; url: string }>> = [];
  if (appUrl) {
    buttons.push([
      { text: '📨 Відкрити інбокс', url: `${appUrl}/admin/marketplaces?tab=messages` },
    ]);
  }

  try {
    await sendMessage(Number(chatId), text, {
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Notify manager that a marketplace order was imported but local stock was
 * insufficient — the customer was already charged on the marketplace, so we
 * force quantity to 0 and ping the manager to reconcile (reorder, switch the
 * product offline elsewhere, contact the buyer).
 */
export async function notifyManagerOversoldAlert(args: {
  platform: string;
  externalOrderId: string;
  items: { code: string; name?: string; requested: number; available: number }[];
}) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken || args.items.length === 0) return;

  const platformLabels: Record<string, string> = {
    olx: 'OLX',
    rozetka: 'Rozetka',
    prom: 'Prom.ua',
    epicentrk: 'Epicentr K',
  };
  const platformName = platformLabels[args.platform] || args.platform;

  const lines = [
    `❗️ <b>Перепродаж на ${platformName}</b>`,
    `Замовлення <code>${args.externalOrderId}</code>`,
    '',
    'Залишку не вистачило:',
    ...args.items
      .slice(0, 10)
      .map(
        (i) =>
          `• <b>${escapeHtml(i.code)}</b>${i.name ? ` ${escapeHtml(i.name.slice(0, 40))}` : ''} — потрібно ${i.requested}, є ${i.available}`,
      ),
  ];
  if (args.items.length > 10) lines.push(`...та ще ${args.items.length - 10} позицій`);
  lines.push('', `${process.env.APP_URL || ''}/admin/orders`);

  try {
    await sendMessage(Number(chatId), lines.join('\n'));
  } catch {
    // Best-effort
  }
}

/**
 * Notify manager that a marketplace just transitioned from healthy to error.
 * No-op if Telegram is not configured.
 */
export async function notifyManagerMarketplaceAlert(args: {
  platform: string;
  error: string;
  previousStatus: string;
  newStatus: string;
}) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken) return;

  const platformLabels: Record<string, string> = {
    olx: 'OLX',
    rozetka: 'Rozetka',
    prom: 'Prom.ua',
    epicentrk: 'Epicentr K',
  };
  const platformName = platformLabels[args.platform] || args.platform;

  const text = [
    `⚠️ <b>Маркетплейс ${platformName} — помилка підключення</b>`,
    '',
    `Стан: ${args.previousStatus} → <b>${args.newStatus}</b>`,
    `Помилка: <code>${args.error.slice(0, 500)}</code>`,
    '',
    `Перевірте кабінет: ${process.env.APP_URL || ''}/admin/marketplaces`,
  ].join('\n');

  try {
    await sendMessage(Number(chatId), text);
  } catch {
    // Best-effort
  }
}

/**
 * Notify client about order status change via Telegram.
 */
export async function notifyClientStatusChange(
  userId: number,
  orderNumber: string,
  oldStatus: string,
  newStatus: string,
  trackingNumber?: string | null,
) {
  const { botToken } = await getTelegramCreds();
  if (!botToken) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });

  if (!user?.telegramChatId) return;

  const chatId = Number(user.telegramChatId);
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const safeOrderNumber = escapeHtml(orderNumber);
  const lines = [
    `📦 <b>Замовлення #${safeOrderNumber}</b>`,
    '',
    `Статус змінено: <b>${escapeHtml(statusLabel)}</b>`,
  ];

  if (newStatus === 'shipped' && trackingNumber) {
    lines.push(`📋 ТТН: <b>${escapeHtml(trackingNumber)}</b>`);
  }

  if (newStatus === 'cancelled') {
    lines.push('\n❌ Ваше замовлення було скасовано.');
  }

  if (newStatus === 'completed') {
    lines.push('\n✅ Дякуємо за покупку!');
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  // Link directly to the public tracking page for THIS order, not the orders
  // list — saves the customer from hunting through pages and works whether
  // they're logged in or not.
  const orderUrl = `${appUrl}/order/${encodeURIComponent(orderNumber)}/track`;

  try {
    await sendMessage(chatId, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Деталі замовлення', url: orderUrl }]],
      },
    });
  } catch {
    // Don't fail status update if notification fails
  }
}

/**
 * Notify manager about a new feedback/callback request.
 */
export async function notifyManagerFeedback(data: {
  type: 'form' | 'callback';
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
}) {
  const { botToken, managerChatId: chatId } = await getTelegramCreds();
  if (!chatId || !botToken) return;

  const icon = data.type === 'callback' ? '📞' : '📨';
  const label =
    data.type === 'callback' ? 'Запит на зворотний дзвінок' : "Повідомлення зворотного зв'язку";
  const lines = [
    `${icon} <b>${label}</b>`,
    '',
    `👤 ${escapeHtml(data.name)}`,
    data.phone ? `📱 ${escapeHtml(data.phone)}` : '',
    data.email ? `📧 ${escapeHtml(data.email)}` : '',
    data.subject ? `📋 ${escapeHtml(data.subject)}` : '',
    `💬 ${escapeHtml(data.message.slice(0, 300))}`,
  ].filter(Boolean);

  try {
    await sendMessage(Number(chatId), lines.join('\n'));
  } catch {
    // Don't fail if notification fails
  }
}

/**
 * Check if bot is within working hours.
 * Returns true if bot should respond, false if outside schedule.
 */
async function isBotWithinSchedule(): Promise<boolean> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'bot_schedule' },
    });
    if (!setting) return true; // no schedule = always on

    const config = JSON.parse(setting.value) as {
      enabled: boolean;
      startHour: number;
      endHour: number;
      timezone: string;
    };

    if (!config.enabled) return true;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: config.timezone || 'Europe/Kyiv',
    });
    const currentHour = Number(formatter.format(now));

    return currentHour >= config.startHour && currentHour < config.endHour;
  } catch {
    return true;
  }
}

async function handleOutsideSchedule(chatId: number) {
  await sendMessage(
    chatId,
    '🕐 Бот працює з 9:00 до 18:00.\nВаше повідомлення буде оброблено в робочий час.\n\nАбо відвідайте наш сайт:',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Перейти на сайт', url: process.env.APP_URL || 'http://localhost:3000' }],
        ],
      },
    },
  );
}

/**
 * Generate a one-time token for linking Telegram account.
 */
export async function generateLinkToken(chatId: number): Promise<string> {
  const { randomBytes } = await import('crypto');
  const token = randomBytes(16).toString('hex');
  const { redis } = await import('@/lib/redis');
  await redis.setex(`tg_link:${token}`, 600, String(chatId)); // 10 min expiry
  return token;
}

/**
 * Complete Telegram account linking using a token.
 */
export async function linkTelegramAccount(userId: number, token: string): Promise<boolean> {
  const { redis } = await import('@/lib/redis');
  const chatId = await redis.get(`tg_link:${token}`);
  if (!chatId) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { telegramChatId: BigInt(chatId) },
  });

  await redis.del(`tg_link:${token}`);

  // Notify user in Telegram
  await sendMessage(
    Number(chatId),
    "✅ Акаунт успішно прив'язано! Тепер ви будете отримувати сповіщення тут.",
  );
  return true;
}

async function handleLink(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const token = await generateLinkToken(chatId);
  await sendMessage(chatId, "🔗 Для прив'язки акаунту натисніть на кнопку нижче:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔗 Прив'язати акаунт",
            url: `${appUrl}/account/settings?link_telegram=${token}`,
          },
        ],
      ],
    },
  });
}

/**
 * Handle Telegram inline query (search products).
 */
async function handleInlineQuery(queryId: string, query: string) {
  const { botToken } = await getTelegramCreds();
  if (!botToken) return;
  const apiBase = apiBaseFor(botToken);

  if (!query || query.length < 2) {
    await fetch(`${apiBase}/answerInlineQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inline_query_id: queryId, results: [], cache_time: 10 }),
    });
    return;
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true, priceRetail: true, code: true, imagePath: true },
    take: 10,
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const results = products.map((p) => ({
    type: 'article',
    id: String(p.id),
    title: p.name,
    description: `${p.code} — ${Number(p.priceRetail).toFixed(2)} ₴`,
    thumbnail_url: p.imagePath ? `${appUrl}${p.imagePath}` : undefined,
    input_message_content: {
      message_text: `<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: ${Number(p.priceRetail).toFixed(2)} ₴\n\n${appUrl}/product/${p.slug}?${botUtm('inline_query')}`,
      parse_mode: 'HTML',
    },
  }));

  await fetch(`${apiBase}/answerInlineQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inline_query_id: queryId, results, cache_time: 30 }),
  });
}

/**
 * @description Головний обробник вебхуків Telegram: обробляє повідомлення, callback-запити та inline-запити.
 * @param update - Об'єкт оновлення від Telegram API
 * @returns void
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  try {
    // Handle inline queries (product search)
    if (update.inline_query) {
      await handleInlineQuery(update.inline_query.id, update.inline_query.query);
      return;
    }

    if (update.callback_query) {
      const { id, data, message } = update.callback_query;
      const chatId = message?.chat.id;
      if (!chatId || !data) return;

      await answerCallbackQuery(id);

      // Check bot schedule
      if (!(await isBotWithinSchedule())) {
        await handleOutsideSchedule(chatId);
        return;
      }

      if (data === 'menu') await handleStart(chatId, update.callback_query.from.first_name);
      else if (data === 'catalog') await handleCatalog(chatId);
      else if (data.startsWith('cat_products:')) {
        const parts = data.split(':');
        await handleCategoryProducts(chatId, Number(parts[1]), Number(parts[2]) || 0);
      } else if (data.startsWith('cat_'))
        await handleCategoryProducts(chatId, Number(data.replace('cat_', '')));
      else if (data.startsWith('promo:')) {
        const promoOffset = Number(data.split(':')[1]) || 0;
        await handlePromo(chatId, promoOffset);
      } else if (data === 'promo') await handlePromo(chatId);
      else if (data === 'new') await handleNew(chatId);
      else if (data === 'popular') await handlePopular(chatId);
      else if (data === 'feedback') await handleFeedbackStart(chatId);
      else if (data === 'orders') await handleOrders(chatId);
      else if (data === 'contact') await handleContact(chatId);
      else if (data === 'about') await handleContact(chatId);
      else if (data === 'settings') await handleSettings(chatId);
      else if (data === 'settings_notif:on') await handleSettingsToggleNotification(chatId, true);
      else if (data === 'settings_notif:off') await handleSettingsToggleNotification(chatId, false);
      else if (data === 'link') await handleLink(chatId);
      return;
    }

    if (update.message?.text) {
      const { chat, text, from } = update.message;
      const chatId = chat.id;

      // /start and /link always work regardless of schedule
      if (text === '/start' || text === '/menu') return handleStart(chatId, from.first_name);
      if (text === '/link') return handleLink(chatId);

      // Check bot schedule
      if (!(await isBotWithinSchedule())) {
        await handleOutsideSchedule(chatId);
        return;
      }

      // Cancel feedback mode
      if (text === '/cancel') {
        if (await feedbackAwaiters.has(chatId)) {
          await feedbackAwaiters.delete(chatId);
          await sendMessage(chatId, 'Відгук скасовано.', {
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ Головне меню', callback_data: 'menu' }]],
            },
          });
        }
        return;
      }

      if (text === '/catalog') return handleCatalog(chatId);
      if (text === '/promo') return handlePromo(chatId);
      if (text === '/new') return handleNew(chatId);
      if (text === '/popular') return handlePopular(chatId);
      if (text === '/feedback') return handleFeedbackStart(chatId);
      if (text === '/settings') return handleSettings(chatId);
      if (text === '/orders') return handleOrders(chatId);
      if (text === '/help') return handleHelp(chatId);
      if (text === '/contact') return handleContact(chatId);
      if (text === '/prices') return handleWholesalePrices(chatId);
      if (text.startsWith('/search ')) return handleSearch(chatId, text.slice(8).trim());
      if (text.startsWith('/barcode ') || text.startsWith('/штрихкод ')) {
        const q = text.replace(/^\/(barcode|штрихкод)\s+/, '').trim();
        return handleBarcodeLookup(chatId, q);
      }

      // Bare digit sequence (10-14 digits) — treat as barcode scan. Lets
      // a warehouse worker just paste/scan the number without remembering
      // the /barcode prefix.
      const digits = text.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 14 && digits === text.trim()) {
        return handleBarcodeLookup(chatId, digits);
      }

      // If user is submitting feedback text
      if (await feedbackAwaiters.has(chatId)) {
        return handleFeedbackSubmit(chatId, text, from.first_name);
      }

      // Auto-reply rules take precedence over the search fallback
      const autoReply = await findAutoReply('telegram', text);
      if (autoReply) {
        const inline = parseAutoReplyButtons(autoReply.buttons);
        await sendMessage(chatId, autoReply.responseText, {
          ...(inline ? { reply_markup: { inline_keyboard: inline } } : {}),
        });
        return;
      }

      // Treat any other text as a search query
      if (text.length >= 2 && !text.startsWith('/')) {
        return handleSearch(chatId, text);
      }
    }
  } catch (error) {
    logger.error('Telegram webhook error', { error: String(error) });
  }
}

/**
 * Show wholesale prices for linked wholesale users.
 */
async function handleWholesalePrices(chatId: number) {
  const user = await findLinkedUser(chatId);
  if (!user || user.role !== 'wholesaler') {
    await sendMessage(
      chatId,
      '⚠️ Гуртові ціни доступні тільки для авторизованих гуртових клієнтів.\n\nЗверніться до менеджера для отримання гуртового статусу.',
    );
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, priceWholesale: { not: null } },
    select: { name: true, slug: true, priceRetail: true, priceWholesale: true, code: true },
    orderBy: { ordersCount: 'desc' },
    take: 10,
  });

  if (products.length === 0) {
    await sendMessage(chatId, 'Гуртові ціни тимчасово недоступні.');
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  let text = '💼 <b>Гуртові ціни (Топ-10):</b>\n\n';
  for (const p of products) {
    const retail = Number(p.priceRetail).toFixed(2);
    const wholesale = p.priceWholesale ? Number(p.priceWholesale).toFixed(2) : retail;
    text += `<b>${escapeHtml(p.name)}</b>\nРоздріб: ${retail} ₴ → <b>Опт: ${wholesale} ₴</b>\n\n`;
  }

  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 Повний каталог', url: `${appUrl}/catalog?${botUtm('wholesale_prices')}` }],
      ],
    },
  });
}
