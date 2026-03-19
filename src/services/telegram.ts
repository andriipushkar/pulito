import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

async function sendMessage(chatId: number, text: string, options?: {
  parse_mode?: string;
  reply_markup?: unknown;
}) {
  await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup,
    }),
  });
}

async function sendPhoto(chatId: number, photoUrl: string, caption: string, options?: {
  parse_mode?: string;
  reply_markup?: unknown;
}) {
  await fetch(`${API_BASE}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup,
    }),
  });
}

/**
 * Send a product message: uses sendPhoto if image exists, otherwise sendMessage.
 */
async function sendProductMessage(chatId: number, text: string, imageUrl: string | null, options?: {
  parse_mode?: string;
  reply_markup?: unknown;
}) {
  if (imageUrl) {
    await sendPhoto(chatId, imageUrl, text, options);
  } else {
    await sendMessage(chatId, text, options);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${API_BASE}/answerCallbackQuery`, {
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
    [{ text: '🛒 Каталог', callback_data: 'catalog' }, { text: '🔥 Акції', callback_data: 'promo' }],
    [{ text: '🆕 Новинки', callback_data: 'new' }, { text: '⭐ Популярне', callback_data: 'popular' }],
    [{ text: '📦 Мої замовлення', callback_data: 'orders' }, { text: '✍️ Відгук', callback_data: 'feedback' }],
    [{ text: '📞 Зв\'язатися', callback_data: 'contact' }, { text: '⚙️ Налаштування', callback_data: 'settings' }],
  ],
};

async function handleStart(chatId: number, firstName: string) {
  const user = await findLinkedUser(chatId);
  const greeting = user
    ? `Вітаємо, ${user.fullName || firstName}! 👋`
    : `Вітаємо у Порошок, ${firstName}! 👋`;

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
      select: { id: true, name: true, slug: true, priceRetail: true, isPromo: true, code: true, imagePath: true },
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
    const text = `${badge}<b>${p.name}</b>\nКод: ${p.code}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?utm_source=telegram&utm_medium=bot` }],
        ],
      },
    });
  }

  // Pagination buttons
  const paginationButtons: { text: string; callback_data: string }[] = [];
  if (offset > 0) {
    paginationButtons.push({ text: '◀️ Назад', callback_data: `cat_products:${categoryId}:${offset - PRODUCTS_PER_PAGE}` });
  }
  if (offset + PRODUCTS_PER_PAGE < totalCount) {
    paginationButtons.push({ text: 'Вперед ▶️', callback_data: `cat_products:${categoryId}:${offset + PRODUCTS_PER_PAGE}` });
  }

  if (paginationButtons.length > 0) {
    await sendMessage(chatId, 'Навігація:', {
      reply_markup: {
        inline_keyboard: [
          paginationButtons,
          [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
        ],
      },
    });
  }
}

async function handlePromo(chatId: number, offset: number = 0) {
  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isPromo: true },
      select: { id: true, name: true, slug: true, priceRetail: true, priceRetailOld: true, code: true, imagePath: true },
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
    const text = `<b>${p.name}</b>\n${oldPrice}<b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 Купити', url: `${appUrl}/product/${p.slug}?utm_source=telegram` }]],
      },
    });
  }

  // Pagination buttons
  const paginationButtons: { text: string; callback_data: string }[] = [];
  if (offset > 0) {
    paginationButtons.push({ text: '◀️ Назад', callback_data: `promo:${offset - PRODUCTS_PER_PAGE}` });
  }
  if (offset + PRODUCTS_PER_PAGE < totalCount) {
    paginationButtons.push({ text: 'Вперед ▶️', callback_data: `promo:${offset + PRODUCTS_PER_PAGE}` });
  }

  if (paginationButtons.length > 0) {
    await sendMessage(chatId, 'Навігація:', {
      reply_markup: {
        inline_keyboard: [
          paginationButtons,
          [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
        ],
      },
    });
  }
}

async function handleOrders(chatId: number) {
  const user = await findLinkedUser(chatId);
  if (!user) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await sendMessage(chatId, 'Для перегляду замовлень прив\'яжіть акаунт:', {
      reply_markup: {
        inline_keyboard: [[{ text: '🔗 Увійти в акаунт', url: `${appUrl}/auth/login?telegram=${chatId}` }]],
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
    new_order: '🆕', processing: '⏳', confirmed: '✅', paid: '💰',
    shipped: '🚚', completed: '✅', cancelled: '❌', returned: '↩️',
  };

  let text = '📦 <b>Ваші замовлення:</b>\n\n';
  for (const o of orders) {
    const emoji = statusEmoji[o.status] || '📦';
    const date = new Date(o.createdAt).toLocaleDateString('uk-UA');
    text += `${emoji} #${o.orderNumber} — ${Number(o.totalAmount).toFixed(2)} ₴ (${date})\n`;
  }

  await sendMessage(chatId, text);
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
    await sendMessage(chatId, `На жаль, за запитом «${query}» нічого не знайдено.\nСпробуйте інший запит або перегляньте каталог.`, {
      reply_markup: { inline_keyboard: [[{ text: '🛒 Каталог', callback_data: 'catalog' }]] },
    });
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  await sendMessage(chatId, `🔍 Результати пошуку «${query}»:`);
  for (const p of products) {
    const text = `<b>${p.name}</b>\nКод: ${p.code}\nЦіна: ${Number(p.priceRetail).toFixed(2)} ₴`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?utm_source=telegram` }]],
      },
    });
  }
}

async function handleNew(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, priceRetail: true, code: true, imagePath: true, createdAt: true },
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
    const text = `<b>${p.name}</b>\nКод: ${p.code}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>\nДодано: ${date}`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?utm_source=telegram` }]],
      },
    });
  }
}

async function handlePopular(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, priceRetail: true, code: true, imagePath: true, ordersCount: true },
    orderBy: { ordersCount: 'desc' },
    take: PRODUCTS_PER_PAGE,
  });

  if (products.length === 0) {
    await sendMessage(chatId, 'Наразі немає популярних товарів.');
    return;
  }

  await sendMessage(chatId, '⭐ <b>Популярні товари:</b>');
  for (const p of products) {
    const text = `<b>${p.name}</b>\nКод: ${p.code}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>`;
    const imageUrl = p.imagePath ? `${appUrl}${p.imagePath}` : null;
    await sendProductMessage(chatId, text, imageUrl, {
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 На сайт', url: `${appUrl}/product/${p.slug}?utm_source=telegram` }]],
      },
    });
  }
}

// Track users awaiting feedback text input
const feedbackAwaiters = new Set<number>();

async function handleFeedbackStart(chatId: number) {
  feedbackAwaiters.add(chatId);
  await sendMessage(chatId, '✍️ Напишіть ваш відгук або побажання одним повідомленням.\n\nДля скасування натисніть /cancel');
}

async function handleFeedbackSubmit(chatId: number, message: string, firstName: string) {
  feedbackAwaiters.delete(chatId);

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

  await sendMessage(chatId, '✅ Дякуємо за ваш відгук! Ми обов\'язково його розглянемо.', {
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
    await sendMessage(chatId, '⚠️ Для налаштувань потрібно прив\'язати акаунт.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Прив\'язати акаунт', callback_data: 'link' }],
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

  await sendMessage(chatId, `⚙️ <b>Налаштування</b>\n\nTelegram-сповіщення: ${telegramEnabled ? '✅ Увімкнено' : '❌ Вимкнено'}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: toggleText, callback_data: toggleAction }],
        [{ text: '🔗 Прив\'язка акаунту', callback_data: 'link' }],
        [{ text: '⬅️ Головне меню', callback_data: 'menu' }],
      ],
    },
  });
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

  const statusText = enable ? '✅ Telegram-сповіщення увімкнено.' : '❌ Telegram-сповіщення вимкнено.';
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
  await sendMessage(chatId, `📞 <b>Контакти Порошок</b>\n\n📱 Телефон: +380 XX XXX XX XX\n📧 Email: info@poroshok.ua\n🕐 Графік: Пн-Пт 9:00-18:00\n🌐 Сайт: ${appUrl}`);
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId, `<b>Доступні команди:</b>\n\n/start — Головне меню\n/catalog — Каталог товарів\n/promo — Акційні товари\n/new — Новинки\n/popular — Популярні товари\n/search — Пошук товарів\n/orders — Мої замовлення\n/feedback — Залишити відгук\n/settings — Налаштування сповіщень\n/contact — Контакти\n/help — Ця довідка\n\nАбо просто напишіть назву товару для пошуку.`);
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
  link?: string | null
) {
  if (!BOT_TOKEN) return;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const text = `<b>${title}</b>\n\n${message}`;

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
  caption: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });

  if (!user?.telegramChatId) return false;

  const chatId = Number(user.telegramChatId);
  try {
    await sendPhoto(chatId, imageUrl, caption);
    return true;
  } catch {
    return false;
  }
}

/**
 * Notify manager about a new order via Telegram.
 */
export async function notifyManagerNewOrder(order: {
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
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  if (!chatId || !BOT_TOKEN) return;

  const clientLabel = order.clientType === 'wholesale' ? 'Оптовий' : 'Роздрібний';
  const text = [
    `🆕 <b>Нове замовлення #${order.orderNumber}</b>`,
    '',
    `👤 ${order.contactName}`,
    `📱 ${order.contactPhone}`,
    order.contactEmail ? `📧 ${order.contactEmail}` : '',
    '',
    `💰 Сума: <b>${Number(order.totalAmount).toFixed(2)} ₴</b>`,
    `📦 Товарів: ${order.itemsCount}`,
    `🏷 Тип: ${clientLabel}`,
    `🚚 Доставка: ${order.deliveryMethod}`,
    `💳 Оплата: ${order.paymentMethod}`,
  ].filter(Boolean).join('\n');

  try {
    await sendMessage(Number(chatId), text);
  } catch {
    // Don't fail order creation if notification fails
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
  trackingNumber?: string | null
) {
  if (!BOT_TOKEN) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });

  if (!user?.telegramChatId) return;

  const chatId = Number(user.telegramChatId);
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const lines = [
    `📦 <b>Замовлення #${orderNumber}</b>`,
    '',
    `Статус змінено: <b>${statusLabel}</b>`,
  ];

  if (newStatus === 'shipped' && trackingNumber) {
    lines.push(`📋 ТТН: <b>${trackingNumber}</b>`);
  }

  if (newStatus === 'cancelled') {
    lines.push('\n❌ Ваше замовлення було скасовано.');
  }

  if (newStatus === 'completed') {
    lines.push('\n✅ Дякуємо за покупку!');
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  try {
    await sendMessage(chatId, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Деталі замовлення', url: `${appUrl}/account/orders` }],
        ],
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
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  if (!chatId || !BOT_TOKEN) return;

  const icon = data.type === 'callback' ? '📞' : '📨';
  const label = data.type === 'callback' ? 'Запит на зворотний дзвінок' : 'Повідомлення зворотного зв\'язку';
  const lines = [
    `${icon} <b>${label}</b>`,
    '',
    `👤 ${data.name}`,
    data.phone ? `📱 ${data.phone}` : '',
    data.email ? `📧 ${data.email}` : '',
    data.subject ? `📋 ${data.subject}` : '',
    `💬 ${data.message.slice(0, 300)}`,
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
    }
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
  await sendMessage(Number(chatId), '✅ Акаунт успішно прив\'язано! Тепер ви будете отримувати сповіщення тут.');
  return true;
}

async function handleLink(chatId: number) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const token = await generateLinkToken(chatId);
  await sendMessage(
    chatId,
    '🔗 Для прив\'язки акаунту натисніть на кнопку нижче:',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Прив\'язати акаунт', url: `${appUrl}/account/settings?link_telegram=${token}` }],
        ],
      },
    }
  );
}

/**
 * Handle Telegram inline query (search products).
 */
async function handleInlineQuery(queryId: string, query: string) {
  if (!query || query.length < 2) {
    await fetch(`${API_BASE}/answerInlineQuery`, {
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
    thumb_url: p.imagePath ? `${appUrl}${p.imagePath}` : undefined,
    input_message_content: {
      message_text: `<b>${p.name}</b>\nКод: ${p.code}\nЦіна: ${Number(p.priceRetail).toFixed(2)} ₴\n\n${appUrl}/product/${p.slug}?utm_source=telegram`,
      parse_mode: 'HTML',
    },
  }));

  await fetch(`${API_BASE}/answerInlineQuery`, {
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
      }
      else if (data.startsWith('cat_')) await handleCategoryProducts(chatId, Number(data.replace('cat_', '')));
      else if (data.startsWith('promo:')) {
        const promoOffset = Number(data.split(':')[1]) || 0;
        await handlePromo(chatId, promoOffset);
      }
      else if (data === 'promo') await handlePromo(chatId);
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
        if (feedbackAwaiters.has(chatId)) {
          feedbackAwaiters.delete(chatId);
          await sendMessage(chatId, 'Відгук скасовано.', {
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Головне меню', callback_data: 'menu' }]] },
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

      // If user is submitting feedback text
      if (feedbackAwaiters.has(chatId)) {
        return handleFeedbackSubmit(chatId, text, from.first_name);
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
    await sendMessage(chatId, '⚠️ Оптові ціни доступні тільки для авторизованих оптових клієнтів.\n\nЗверніться до менеджера для отримання оптового статусу.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, priceWholesale: { not: null } },
    select: { name: true, slug: true, priceRetail: true, priceWholesale: true, code: true },
    orderBy: { ordersCount: 'desc' },
    take: 10,
  });

  if (products.length === 0) {
    await sendMessage(chatId, 'Оптові ціни тимчасово недоступні.');
    return;
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  let text = '💼 <b>Оптові ціни (Топ-10):</b>\n\n';
  for (const p of products) {
    const retail = Number(p.priceRetail).toFixed(2);
    const wholesale = p.priceWholesale ? Number(p.priceWholesale).toFixed(2) : retail;
    text += `<b>${p.name}</b>\nРоздріб: ${retail} ₴ → <b>Опт: ${wholesale} ₴</b>\n\n`;
  }

  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 Повний каталог', url: `${appUrl}/catalog?utm_source=telegram` }],
      ],
    },
  });
}
