/**
 * Full marketing/SEO/operations/payments audit — counts what's configured vs
 * empty across every module. Read-only; safe to run any time.
 *
 * Output: console table + writes Markdown report to /foto/problem/full-audit.md
 *
 * Usage:  npx tsx scripts/full-audit.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { writeFileSync } from 'fs';

type Status = 'ok' | 'partial' | 'empty' | 'na';
interface Row {
  group: string;
  module: string;
  status: Status;
  details: string;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function main() {
  const rows: Row[] = [];
  const settings = await safe(
    async () => {
      const all = await prisma.siteSetting.findMany();
      const map: Record<string, string> = {};
      for (const s of all) map[s.key] = s.value;
      return map;
    },
    {} as Record<string, string>,
  );

  const has = (key: string) => !!settings[key]?.trim();
  const hasEnv = (key: string) => !!process.env[key]?.trim();

  // ═══════════════════════════════════════════════════════════════════
  // 🔍 SEO & Analytics
  // ═══════════════════════════════════════════════════════════════════
  const SEO = 'SEO & Analytics';
  rows.push({
    group: SEO,
    module: 'Google Site Verification',
    status: hasEnv('GOOGLE_SITE_VERIFICATION') ? 'ok' : 'empty',
    details: hasEnv('GOOGLE_SITE_VERIFICATION')
      ? 'env встановлено'
      : 'env GOOGLE_SITE_VERIFICATION — без цього GSC не підтвердить власність',
  });
  rows.push({
    group: SEO,
    module: 'GA4 (Google Analytics)',
    status: has('google_analytics_id') ? 'ok' : 'empty',
    details: has('google_analytics_id')
      ? `ID: ${settings.google_analytics_id}`
      : '/admin/settings → google_analytics_id',
  });
  rows.push({
    group: SEO,
    module: 'Facebook Pixel (ретаргетинг)',
    status: has('facebook_pixel_id') ? 'ok' : 'empty',
    details: has('facebook_pixel_id')
      ? `ID: ${settings.facebook_pixel_id}`
      : '/admin/settings → facebook_pixel_id',
  });
  rows.push({
    group: SEO,
    module: 'Twitter Handle',
    status: hasEnv('TWITTER_HANDLE') ? 'ok' : 'empty',
    details: hasEnv('TWITTER_HANDLE')
      ? process.env.TWITTER_HANDLE!
      : 'env TWITTER_HANDLE — для Twitter Card credit',
  });
  rows.push({
    group: SEO,
    module: 'Microsoft Clarity (heatmap)',
    status: has('microsoft_clarity_id') ? 'ok' : 'empty',
    details: has('microsoft_clarity_id')
      ? `ID: ${settings.microsoft_clarity_id}`
      : 'безкоштовний heatmap → /admin/settings → microsoft_clarity_id (опційно)',
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🏢 Site identity & socials
  // ═══════════════════════════════════════════════════════════════════
  const IDENT = 'Site identity';
  const identityFields = [
    'site_name',
    'site_phone',
    'site_email',
    'site_address',
    'company_description',
  ];
  const identityFilled = identityFields.filter((k) => has(k)).length;
  const identityMissing = identityFields.filter((k) => !has(k));
  rows.push({
    group: IDENT,
    module: 'Identity (name/phone/email/address/desc)',
    status:
      identityFilled === identityFields.length ? 'ok' : identityFilled > 0 ? 'partial' : 'empty',
    details: `${identityFilled}/${identityFields.length} заповнено${identityMissing.length ? `, бракує: ${identityMissing.join(', ')}` : ''}`,
  });

  const socials = [
    'social_instagram',
    'social_telegram',
    'social_tiktok',
    'social_facebook',
    'social_viber',
  ];
  const socialsFilled = socials.filter((k) => has(k)).length;
  rows.push({
    group: IDENT,
    module: 'Соц-мережі (sameAs + rel=me)',
    status: socialsFilled >= 3 ? 'ok' : socialsFilled > 0 ? 'partial' : 'empty',
    details: `${socialsFilled}/${socials.length} соц-мереж — потрібно для Organization JSON-LD`,
  });
  rows.push({
    group: IDENT,
    module: 'Теми / Брендинг (Themes)',
    status: await safe(async () => ((await prisma.theme.count()) > 0 ? 'ok' : 'empty'), 'empty'),
    details: `${await safe(() => prisma.theme.count(), 0)} тем у системі. /admin/themes`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 📦 Content
  // ═══════════════════════════════════════════════════════════════════
  const CONT = 'Контент';
  const products = await safe(() => prisma.product.count({ where: { isActive: true } }), 0);
  const productsWithoutDesc = await safe(
    () =>
      prisma.product.count({
        where: {
          isActive: true,
          OR: [
            { content: null },
            { content: { fullDescription: null } },
            { content: { fullDescription: '' } },
          ],
        },
      }),
    0,
  );
  rows.push({
    group: CONT,
    module: 'Товари',
    status: products > 0 ? 'ok' : 'empty',
    details: `${products} активних, з них ${productsWithoutDesc} без опису`,
  });

  const productsWithoutImage = await safe(
    () =>
      prisma.product.count({
        where: { isActive: true, images: { none: {} } },
      }),
    0,
  );
  rows.push({
    group: CONT,
    module: 'Товари — фото',
    status:
      productsWithoutImage === 0 && products > 0
        ? 'ok'
        : productsWithoutImage > 0
          ? 'partial'
          : 'empty',
    details: `${productsWithoutImage}/${products} товарів БЕЗ фото (Google Shopping не покаже)`,
  });

  const variants = await safe(() => prisma.productVariant.count(), 0);
  rows.push({
    group: CONT,
    module: 'Варіанти товарів',
    status: variants > 0 ? 'ok' : 'empty',
    details: `${variants} варіантів. /admin/products → варіанти (розмір/колір/смак)`,
  });

  const categories = await safe(() => prisma.category.count({ where: { deletedAt: null } }), 0);
  const categoriesWithoutDesc = await safe(
    () =>
      prisma.category.count({
        where: { deletedAt: null, OR: [{ description: null }, { description: '' }] },
      }),
    0,
  );
  rows.push({
    group: CONT,
    module: 'Категорії',
    status:
      categories > 0 && categoriesWithoutDesc === 0
        ? 'ok'
        : categoriesWithoutDesc > 0
          ? 'partial'
          : 'empty',
    details: `${categories} категорій, з них ${categoriesWithoutDesc} БЕЗ опису (критично для SEO)`,
  });

  const brands = await safe(() => prisma.brand.count({ where: { deletedAt: null } }), 0);
  rows.push({
    group: CONT,
    module: 'Бренди',
    status: brands > 0 ? 'ok' : 'empty',
    details: `${brands} брендів`,
  });

  const blogPosts = await safe(() => prisma.blogPost.count({ where: { isPublished: true } }), 0);
  rows.push({
    group: CONT,
    module: 'Блог',
    status: blogPosts >= 10 ? 'ok' : blogPosts > 0 ? 'partial' : 'empty',
    details: `${blogPosts} постів. Для SEO: 10+ і регулярні нові 1-2/тижд`,
  });

  const staticPages = await safe(
    () => prisma.staticPage.count({ where: { isPublished: true } }),
    0,
  );
  rows.push({
    group: CONT,
    module: 'Статичні сторінки',
    status: staticPages >= 6 ? 'ok' : staticPages > 0 ? 'partial' : 'empty',
    details: `${staticPages} сторінок. Має бути: Про нас, Доставка, Оплата, Privacy Policy, Terms, Returns`,
  });

  const faqItems = await safe(() => prisma.faqItem.count({ where: { isPublished: true } }), 0);
  rows.push({
    group: CONT,
    module: 'FAQ',
    status: faqItems >= 10 ? 'ok' : faqItems > 0 ? 'partial' : 'empty',
    details: `${faqItems} питань. Мінімум 10 для FAQ rich snippet у Google`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 💳 Платежі
  // ═══════════════════════════════════════════════════════════════════
  const PAY = 'Платежі';
  rows.push({
    group: PAY,
    module: 'LiqPay',
    status:
      (has('payment_liqpay_public_key') || hasEnv('LIQPAY_PUBLIC_KEY')) &&
      (has('payment_liqpay_private_key') || hasEnv('LIQPAY_PRIVATE_KEY'))
        ? 'ok'
        : 'empty',
    details: '/admin/payment-settings → LiqPay keys (картки Visa/MC)',
  });
  rows.push({
    group: PAY,
    module: 'MonoBank',
    status: has('payment_monobank_token') || hasEnv('MONOBANK_TOKEN') ? 'ok' : 'empty',
    details: '/admin/payment-settings → MonoBank token',
  });
  rows.push({
    group: PAY,
    module: 'WayForPay',
    status:
      (has('payment_wayforpay_merchant_account') || hasEnv('WAYFORPAY_MERCHANT_ACCOUNT')) &&
      (has('payment_wayforpay_secret_key') || hasEnv('WAYFORPAY_SECRET_KEY'))
        ? 'ok'
        : 'empty',
    details: '/admin/payment-settings → WayForPay keys (альтернатива LiqPay)',
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🚚 Доставка
  // ═══════════════════════════════════════════════════════════════════
  const DEL = 'Доставка';
  rows.push({
    group: DEL,
    module: 'Нова Пошта',
    status: has('delivery_nova_poshta_api_key') || hasEnv('NOVA_POSHTA_API_KEY') ? 'ok' : 'empty',
    details: '/admin/delivery-settings → Nova Poshta API key (для відділень + TTN)',
  });
  rows.push({
    group: DEL,
    module: 'Укрпошта',
    status: has('delivery_ukrposhta_bearer_token') ? 'ok' : 'empty',
    details: '/admin/delivery-settings → Ukrposhta bearer token (опційно)',
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🎯 Promotions
  // ═══════════════════════════════════════════════════════════════════
  const PROMO = 'Промо';
  const banners = await safe(() => prisma.banner.count({ where: { isActive: true } }), 0);
  rows.push({
    group: PROMO,
    module: 'Банери головної',
    status: banners > 0 ? 'ok' : 'empty',
    details: `${banners} активних. /admin/banners`,
  });
  const bundles = await safe(() => prisma.bundle.count({ where: { isActive: true } }), 0);
  rows.push({
    group: PROMO,
    module: 'Комплекти (bundles)',
    status: bundles > 0 ? 'ok' : 'empty',
    details: `${bundles} активних. Збільшують середній чек`,
  });
  const coupons = await safe(() => prisma.coupon.count({ where: { isActive: true } }), 0);
  rows.push({
    group: PROMO,
    module: 'Купони / промокоди',
    status: coupons > 0 ? 'ok' : 'empty',
    details: `${coupons} активних. /admin/coupons`,
  });
  const loyaltyLevels = await safe(() => prisma.loyaltyLevel.count(), 0);
  const welcomeBonus = Number(settings.loyalty_welcome_bonus) || 0;
  rows.push({
    group: PROMO,
    module: 'Бонусна програма (loyalty)',
    status:
      loyaltyLevels > 0 && welcomeBonus > 0
        ? 'ok'
        : loyaltyLevels > 0 || welcomeBonus > 0
          ? 'partial'
          : 'empty',
    details: `${loyaltyLevels} рівнів, welcome bonus: ${welcomeBonus}. /admin/loyalty`,
  });
  const referrerBonus = Number(settings.referral_referrer_bonus) || 0;
  const refereeBonus = Number(settings.referral_referee_bonus) || 0;
  rows.push({
    group: PROMO,
    module: 'Реферальна програма',
    status: referrerBonus > 0 && refereeBonus > 0 ? 'ok' : 'empty',
    details: `Запрошувач: +${referrerBonus}, друг: +${refereeBonus} балів. /admin/settings`,
  });
  const challenges = await safe(
    () => prisma.loyaltyChallenge.count({ where: { isActive: true } }),
    0,
  );
  rows.push({
    group: PROMO,
    module: 'Loyalty challenges (квести)',
    status: challenges > 0 ? 'ok' : 'empty',
    details: `${challenges} активних. Гейміфікація — повертає клієнтів`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 📧 Marketing automation
  // ═══════════════════════════════════════════════════════════════════
  const MA = 'Marketing automation';
  const smtpConfigured = has('smtp_host') && has('smtp_user');
  rows.push({
    group: MA,
    module: 'SMTP (відправка email)',
    status: smtpConfigured ? 'ok' : 'empty',
    details: smtpConfigured
      ? `host: ${settings.smtp_host}`
      : '/admin/smtp-settings — без цього email не йдуть',
  });
  const emailTemplates = await safe(() => prisma.emailTemplate.count(), 0);
  rows.push({
    group: MA,
    module: 'Email шаблони',
    status: emailTemplates >= 5 ? 'ok' : emailTemplates > 0 ? 'partial' : 'empty',
    details: `${emailTemplates} шаблонів. Мінімум: welcome, cart abandonment, order, shipping, review request`,
  });
  const cartRecoveries = await safe(() => prisma.cartRecoveryEvent.count(), 0);
  rows.push({
    group: MA,
    module: 'Cart abandonment events',
    status: cartRecoveries > 0 ? 'ok' : 'empty',
    details: `${cartRecoveries} подій відновлення кошика. Працює авто якщо є email template + SMTP`,
  });
  const campaigns = await safe(() => prisma.campaignRule.count({ where: { isActive: true } }), 0);
  rows.push({
    group: MA,
    module: 'Маркетинг-кампанії (rules)',
    status: campaigns > 0 ? 'ok' : 'empty',
    details: `${campaigns} активних. /admin/campaigns — авто-промо за подіями`,
  });
  const segments = await safe(() => prisma.entityTag.count({ where: { entityType: 'user' } }), 0);
  rows.push({
    group: MA,
    module: 'Сегментація клієнтів',
    status: segments > 0 ? 'ok' : 'empty',
    details: `${segments} тегів на користувачах. Для таргетованих розсилок`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 📱 Канали (соц-мережі + маркетплейси)
  // ═══════════════════════════════════════════════════════════════════
  const CH = 'Канали';
  const mpConnections = await safe(
    () => prisma.marketplaceConnection.findMany({ select: { platform: true, isActive: true } }),
    [] as { platform: string; isActive: boolean }[],
  );
  const mpByType = mpConnections.reduce<Record<string, { total: number; active: number }>>(
    (acc, c) => {
      acc[c.platform] ??= { total: 0, active: 0 };
      acc[c.platform].total += 1;
      if (c.isActive) acc[c.platform].active += 1;
      return acc;
    },
    {},
  );

  for (const type of ['prom', 'rozetka', 'allo', 'olx']) {
    const c = mpByType[type];
    rows.push({
      group: CH,
      module: `Маркетплейс: ${type}`,
      status: !c ? 'empty' : c.active > 0 ? 'ok' : 'partial',
      details: !c ? 'не підключено' : `активних: ${c.active}/${c.total}`,
    });
  }

  // Social-channel posting credentials live in SiteSetting (per-channel token).
  // No dedicated table — check whether the channel-config has a token saved.
  const socialChannels: Array<{ key: string; label: string }> = [
    { key: 'channel_facebook_page_token', label: 'facebook' },
    { key: 'channel_instagram_business_id', label: 'instagram' },
    { key: 'telegram_bot_token', label: 'telegram' },
    { key: 'channel_viber_token', label: 'viber' },
  ];
  for (const { key, label } of socialChannels) {
    rows.push({
      group: CH,
      module: `Соцмережа: ${label}`,
      status: has(key) || hasEnv(key.toUpperCase()) ? 'ok' : 'empty',
      details:
        has(key) || hasEnv(key.toUpperCase()) ? 'токен налаштовано' : `токен відсутній (${key})`,
    });
  }
  const listings = await safe(() => prisma.marketplaceListing.count(), 0);
  rows.push({
    group: CH,
    module: 'Маркетплейс листинги (товари в маркетах)',
    status: listings > 0 ? 'ok' : 'empty',
    details: `${listings} товарів синхронізовано`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🤖 Боти + Push
  // ═══════════════════════════════════════════════════════════════════
  const BOT = 'Боти & сповіщення';
  const botSettings = await safe(
    () => prisma.botWelcomeMessage.count({ where: { isActive: true } }),
    0,
  );
  rows.push({
    group: BOT,
    module: 'Telegram/Viber welcome message',
    status: botSettings > 0 ? 'ok' : 'empty',
    details: `${botSettings} активних. /admin/bot-settings`,
  });
  const autoReplies = await safe(() => prisma.botAutoReply.count({ where: { isActive: true } }), 0);
  rows.push({
    group: BOT,
    module: 'Бот авто-відповіді',
    status: autoReplies > 0 ? 'ok' : 'empty',
    details: `${autoReplies} правил. /admin/bot-settings → auto-replies`,
  });
  const pushSubs = await safe(() => prisma.pushSubscription.count(), 0);
  rows.push({
    group: BOT,
    module: 'Web Push підписки',
    status: pushSubs > 0 ? 'ok' : 'empty',
    details: `${pushSubs} підписок. Браузерні push для повернення клієнтів`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 👥 Customers / orders
  // ═══════════════════════════════════════════════════════════════════
  const CU = 'Клієнти & замовлення';
  const totalUsers = await safe(() => prisma.user.count(), 0);
  const wholesalers = await safe(() => prisma.user.count({ where: { role: 'wholesaler' } }), 0);
  rows.push({
    group: CU,
    module: 'Користувачі',
    status: totalUsers >= 50 ? 'ok' : totalUsers > 0 ? 'partial' : 'empty',
    details: `${totalUsers} зареєстрованих, з них ${wholesalers} B2B (wholesalers)`,
  });
  const subscribers = await safe(
    () => prisma.subscriber.count({ where: { unsubscribedAt: null } }),
    0,
  );
  rows.push({
    group: CU,
    module: 'База newsletter',
    status: subscribers >= 50 ? 'ok' : subscribers > 0 ? 'partial' : 'empty',
    details: `${subscribers} активних підписників`,
  });
  const orders = await safe(() => prisma.order.count(), 0);
  const recentOrders = await safe(
    () =>
      prisma.order.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600_000) } },
      }),
    0,
  );
  rows.push({
    group: CU,
    module: 'Замовлення',
    status: recentOrders >= 10 ? 'ok' : orders > 0 ? 'partial' : 'empty',
    details: `${orders} всього, ${recentOrders} за останні 30 днів`,
  });
  const subscriptions = await safe(
    () => prisma.subscription.count({ where: { status: 'active' } }),
    0,
  );
  rows.push({
    group: CU,
    module: 'Підписки на товари',
    status: subscriptions > 0 ? 'ok' : 'empty',
    details: `${subscriptions} активних. Стабільний MRR`,
  });
  const wishlists = await safe(() => prisma.wishlistItem.count(), 0);
  rows.push({
    group: CU,
    module: 'Wishlist items',
    status: wishlists > 0 ? 'ok' : 'empty',
    details: `${wishlists} товарів у списках бажань`,
  });
  const reviews = await safe(() => prisma.review.count({ where: { status: 'approved' } }), 0);
  rows.push({
    group: CU,
    module: 'Відгуки клієнтів',
    status: reviews >= 20 ? 'ok' : reviews > 0 ? 'partial' : 'empty',
    details: `${reviews} опублікованих. Для SEO rich snippets: 1+ на товар`,
  });
  const feedbacks = await safe(() => prisma.feedback.count(), 0);
  rows.push({
    group: CU,
    module: 'Feedback / Contact form',
    status: feedbacks >= 0 ? 'ok' : 'empty',
    details: `${feedbacks} повідомлень з форми`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🔧 SEO операційні
  // ═══════════════════════════════════════════════════════════════════
  const SEOOP = 'SEO операції';
  const seoTemplates = await safe(() => prisma.seoTemplate.count(), 0);
  rows.push({
    group: SEOOP,
    module: 'SEO шаблони (auto-gen)',
    status: seoTemplates > 0 ? 'ok' : 'empty',
    details: `${seoTemplates} шаблонів. /admin/seo-templates — авто-SEO для нових товарів`,
  });
  const slugRedirects = await safe(() => prisma.slugRedirect.count(), 0);
  rows.push({
    group: SEOOP,
    module: 'Slug redirects (301)',
    status: 'ok',
    details: `${slugRedirects} активних. Авто-створюються при зміні slug`,
  });
  const notFoundLogs = await safe(() => prisma.notFoundLog.count(), 0);
  const recentNotFound = await safe(
    () =>
      prisma.notFoundLog.count({
        where: { lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
      }),
    0,
  );
  rows.push({
    group: SEOOP,
    module: '404 log',
    status: recentNotFound === 0 ? 'ok' : recentNotFound < 5 ? 'partial' : 'empty',
    details: `${notFoundLogs} помилок всього, ${recentNotFound} за останній тиждень. /admin/not-found-log`,
  });
  const tags = await safe(() => prisma.tag.count(), 0);
  rows.push({
    group: SEOOP,
    module: 'Tags (для long-tail SEO)',
    status: tags > 0 ? 'ok' : 'empty',
    details: `${tags} тегів. Корисні для пов'язаних товарів`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 💼 B2B
  // ═══════════════════════════════════════════════════════════════════
  const B2B = 'B2B / Опт';
  const volumeDiscounts = await safe(() => prisma.volumeDiscount.count(), 0);
  rows.push({
    group: B2B,
    module: 'Volume discounts',
    status: volumeDiscounts > 0 ? 'ok' : 'empty',
    details: `${volumeDiscounts} правил знижок за кількість. /admin/volume-discounts`,
  });
  const wholesaleRules = await safe(() => prisma.wholesaleRule.count(), 0);
  rows.push({
    group: B2B,
    module: 'Wholesale rules',
    status: wholesaleRules > 0 ? 'ok' : 'empty',
    details: `${wholesaleRules} правил для оптових цін`,
  });
  const personalPrices = await safe(() => prisma.personalPrice.count(), 0);
  rows.push({
    group: B2B,
    module: 'Personal prices (VIP клієнти)',
    status: personalPrices > 0 ? 'ok' : 'empty',
    details: `${personalPrices} персональних цін. /admin/personal-prices`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 📦 Склад / інвентаризація
  // ═══════════════════════════════════════════════════════════════════
  const STO = 'Склад';
  const warehouses = await safe(() => prisma.warehouse.count(), 0);
  rows.push({
    group: STO,
    module: 'Склади',
    status: warehouses > 0 ? 'ok' : 'empty',
    details: `${warehouses} складів. Multi-warehouse — /admin/warehouses`,
  });
  const stockCounts = await safe(() => prisma.stockCount.count(), 0);
  rows.push({
    group: STO,
    module: 'Інвентаризації',
    status: stockCounts > 0 ? 'ok' : 'empty',
    details: `${stockCounts} інвентаризацій. /admin/stock-counts`,
  });
  const backInStock = await safe(() => prisma.backInStockSubscription.count(), 0);
  rows.push({
    group: STO,
    module: 'Back-in-stock підписки',
    status: 'ok',
    details: `${backInStock} підписок на надходження`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🛡️ Технічне
  // ═══════════════════════════════════════════════════════════════════
  const TECH = 'Технічне';
  rows.push({
    group: TECH,
    module: 'Sentry (моніторинг помилок)',
    status: hasEnv('SENTRY_DSN') ? 'ok' : 'empty',
    details: hasEnv('SENTRY_DSN')
      ? 'env SENTRY_DSN встановлено'
      : 'env SENTRY_DSN не встановлено — помилки не репортяться',
  });
  rows.push({
    group: TECH,
    module: 'Redis (cache + rate limit)',
    status: hasEnv('REDIS_URL') ? 'ok' : 'empty',
    details: hasEnv('REDIS_URL')
      ? 'env REDIS_URL встановлено'
      : 'без Redis cache і rate-limit обмежені',
  });
  rows.push({
    group: TECH,
    module: 'Cloudflare R2 (cloud storage)',
    status: hasEnv('R2_ACCOUNT_ID') && hasEnv('R2_ACCESS_KEY_ID') ? 'ok' : 'empty',
    details: hasEnv('R2_ACCOUNT_ID')
      ? 'налаштовано'
      : 'фото зберігаються локально (опційно: R2 для CDN)',
  });
  rows.push({
    group: TECH,
    module: 'CDN URL (статика через CDN)',
    status: hasEnv('CDN_URL') ? 'ok' : 'empty',
    details: hasEnv('CDN_URL')
      ? process.env.CDN_URL!
      : 'env CDN_URL не встановлено (Cloudflare HTTP proxy працює без)',
  });
  const apiKeys = await safe(() => prisma.apiKey.count({ where: { isActive: true } }), 0);
  rows.push({
    group: TECH,
    module: 'API ключі (для інтеграцій)',
    status: 'ok',
    details: `${apiKeys} активних API ключів`,
  });
  const featureFlags = await safe(
    () => prisma.featureFlag.count({ where: { isEnabled: true } }),
    0,
  );
  rows.push({
    group: TECH,
    module: 'Feature flags',
    status: featureFlags > 0 ? 'ok' : 'empty',
    details: `${featureFlags} увімкнених фічфлагів. /admin/feature-flags`,
  });
  const webhookSubs = await safe(
    () => prisma.webhookSubscription.count({ where: { isActive: true } }),
    0,
  );
  rows.push({
    group: TECH,
    module: 'Webhook subscriptions',
    status: webhookSubs > 0 ? 'ok' : 'empty',
    details: `${webhookSubs} активних webhook (Telegram, payment callbacks etc.)`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🌐 Multi-tenant / Domains
  // ═══════════════════════════════════════════════════════════════════
  const MT = 'Tenants / Домени';
  const tenants = await safe(() => prisma.tenant.count(), 0);
  rows.push({
    group: MT,
    module: 'Tenants',
    status: tenants > 0 ? 'ok' : 'empty',
    details: `${tenants} tenants (white-label опція)`,
  });

  // ═══════════════════════════════════════════════════════════════════
  // 📊 Print report
  // ═══════════════════════════════════════════════════════════════════
  const groupOrder = [
    SEO,
    IDENT,
    CONT,
    PAY,
    DEL,
    PROMO,
    MA,
    CH,
    BOT,
    CU,
    SEOOP,
    B2B,
    STO,
    TECH,
    MT,
  ];
  const groupIcon: Record<string, string> = {
    [SEO]: '🔍',
    [IDENT]: '🏢',
    [CONT]: '📦',
    [PAY]: '💳',
    [DEL]: '🚚',
    [PROMO]: '🎯',
    [MA]: '📧',
    [CH]: '📱',
    [BOT]: '🤖',
    [CU]: '👥',
    [SEOOP]: '🔧',
    [B2B]: '💼',
    [STO]: '🏬',
    [TECH]: '🛡️ ',
    [MT]: '🌐',
  };
  const statusIcon: Record<Status, string> = { ok: '✅', partial: '⚠️ ', empty: '❌', na: '➖' };

  const lines: string[] = [];
  lines.push('# Pulito.trade — повний аудит модулів\n');
  lines.push(`Згенеровано: ${new Date().toLocaleString('uk-UA')}`);
  lines.push(`Усього модулів: **${rows.length}**\n`);

  for (const group of groupOrder) {
    const items = rows.filter((r) => r.group === group);
    if (items.length === 0) continue;
    lines.push(`\n## ${groupIcon[group] || ''} ${group}\n`);
    lines.push('| Статус | Модуль | Деталі |');
    lines.push('|---|---|---|');
    for (const r of items) {
      lines.push(`| ${statusIcon[r.status]} | **${r.module}** | ${r.details} |`);
    }
  }

  const okCount = rows.filter((r) => r.status === 'ok').length;
  const partialCount = rows.filter((r) => r.status === 'partial').length;
  const emptyCount = rows.filter((r) => r.status === 'empty').length;
  const pct = Math.round((okCount / rows.length) * 100);

  lines.push(`\n## 📊 Підсумок\n`);
  lines.push('| Стан | К-сть |');
  lines.push('|---|---|');
  lines.push(`| ✅ Налаштовано | **${okCount}** |`);
  lines.push(`| ⚠️ Частково | **${partialCount}** |`);
  lines.push(`| ❌ Порожньо | **${emptyCount}** |`);
  lines.push(`| **Всього** | ${rows.length} |`);
  lines.push(`\n**Готовність: ${pct}%**`);

  // Topical priority list — what to fix first
  const critical = rows.filter(
    (r) =>
      r.status === 'empty' &&
      [
        'SMTP (відправка email)',
        'Google Site Verification',
        'GA4 (Google Analytics)',
        'Facebook Pixel (ретаргетинг)',
        'Email шаблони',
        'Соц-мережі (sameAs + rel=me)',
        'LiqPay',
        'Нова Пошта',
      ].includes(r.module),
  );
  if (critical.length > 0) {
    lines.push(`\n## 🔥 Найкритичніше (зробити в першу чергу)\n`);
    for (const r of critical) {
      lines.push(`- ❌ **${r.module}** — ${r.details}`);
    }
  }

  const report = lines.join('\n');
  console.log(report);
  writeFileSync('/home/pulitotrade/pulito/foto/problem/full-audit.md', report);
  console.log('\n\n📝 Збережено: /home/pulitotrade/pulito/foto/problem/full-audit.md');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
