import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AtSign,
  Award,
  BarChart,
  BarChart3,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Container,
  CreditCard,
  DollarSign,
  Download,
  Factory,
  FileSearch,
  FileText,
  Flag,
  FolderTree,
  Globe,
  HelpCircle,
  Home,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Palette,
  Percent,
  Plug,
  Radio,
  Repeat,
  Search,
  Send,
  Settings,
  Settings2,
  Share2,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Webhook,
} from 'lucide-react';

export type SidebarBadgeKey = 'newOrders' | 'newFeedback' | 'pendingWholesale';

export const ADMIN_SECTIONS = [
  'Огляд',
  'Замовлення',
  'Каталог',
  'Склад',
  'Клієнти',
  'Маркетинг',
  'Контент',
  'Канали',
  'Налаштування',
  'Платформа',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export interface AdminPage {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sidebar section. Pages without a section appear in the top (unnamed) group. */
  section?: AdminSection;
  /** Only highlight in sidebar when pathname matches exactly. Used for Dashboard. */
  exact?: boolean;
  /** Live badge key — value comes from useSidebarCounts(). */
  badgeKey?: SidebarBadgeKey;
  /** Hide from sidebar — page is reachable via URL/breadcrumbs/palette but not listed. */
  hiddenFromSidebar?: boolean;
  /** Show only to platform-level admins (super-admin). Hidden from regular admin/manager. */
  platformOnly?: boolean;
}

// Single source of truth: sidebar menu, breadcrumbs, command palette
// all read from this array. Order within a section = order in the sidebar.
export const ADMIN_PAGES: AdminPage[] = [
  // ─── Огляд ─────────────────────────────────────────────────
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true, section: 'Огляд' },
  { href: '/admin/analytics', label: 'Аналітика', icon: TrendingUp, section: 'Огляд' },
  { href: '/admin/reports', label: 'Звіти', icon: BarChart3, section: 'Огляд' },

  // ─── Замовлення ────────────────────────────────────────────
  {
    href: '/admin/orders',
    label: 'Замовлення',
    icon: Package,
    badgeKey: 'newOrders',
    section: 'Замовлення',
  },
  { href: '/admin/pack', label: 'Pick & Pack', icon: ClipboardList, section: 'Замовлення' },
  {
    href: '/admin/pallet-delivery',
    label: 'Палетна доставка',
    icon: Container,
    section: 'Замовлення',
  },
  { href: '/admin/subscriptions', label: 'Підписки', icon: Repeat, section: 'Замовлення' },

  // ─── Каталог ───────────────────────────────────────────────
  { href: '/admin/products', label: 'Товари', icon: ShoppingBag, section: 'Каталог' },
  { href: '/admin/categories', label: 'Категорії', icon: FolderTree, section: 'Каталог' },
  { href: '/admin/brands', label: 'Торгові марки', icon: Factory, section: 'Каталог' },
  { href: '/admin/bundles', label: 'Комплекти', icon: Boxes, section: 'Каталог' },
  { href: '/admin/badges', label: 'Бейджі', icon: Tag, section: 'Каталог' },
  { href: '/admin/import', label: 'Імпорт', icon: Download, section: 'Каталог' },

  // ─── Склад ─────────────────────────────────────────────────
  { href: '/admin/warehouses', label: 'Склади', icon: Warehouse, section: 'Склад' },
  { href: '/admin/stock-counts', label: 'Інвентаризація', icon: ClipboardCheck, section: 'Склад' },
  { href: '/admin/warehouse-transfers', label: 'Переміщення', icon: Truck, section: 'Склад' },

  // ─── Клієнти ───────────────────────────────────────────────
  {
    href: '/admin/users',
    label: 'Користувачі',
    icon: Users,
    badgeKey: 'pendingWholesale',
    section: 'Клієнти',
  },
  { href: '/admin/segments', label: 'Сегменти', icon: Target, section: 'Клієнти' },

  // ─── Маркетинг ─────────────────────────────────────────────
  { href: '/admin/campaigns', label: 'Кампанії', icon: Megaphone, section: 'Маркетинг' },
  {
    href: '/admin/volume-discounts',
    label: 'Знижки за обсягом',
    icon: Percent,
    section: 'Маркетинг',
  },
  {
    href: '/admin/personal-prices',
    label: 'Персональні ціни',
    icon: DollarSign,
    section: 'Маркетинг',
  },
  {
    href: '/admin/wholesale-rules',
    label: 'Гуртові правила',
    icon: Briefcase,
    section: 'Маркетинг',
  },
  { href: '/admin/loyalty', label: 'Лояльність', icon: Award, section: 'Маркетинг' },
  { href: '/admin/referrals', label: 'Реферали', icon: Share2, section: 'Маркетинг' },
  { href: '/admin/coupons', label: 'Промокоди', icon: Tag, section: 'Маркетинг' },
  { href: '/admin/banners', label: 'Банери', icon: ImageIcon, section: 'Маркетинг' },

  // ─── Контент ───────────────────────────────────────────────
  { href: '/admin/blog', label: 'Блог', icon: Newspaper, section: 'Контент' },
  {
    href: '/admin/blog/comments',
    label: 'Коментарі блогу',
    icon: MessageCircle,
    section: 'Контент',
  },
  { href: '/admin/publications', label: 'Публікації', icon: Send, section: 'Контент' },
  {
    href: '/admin/publication-templates',
    label: 'Шаблони публікацій',
    icon: FileText,
    section: 'Контент',
  },
  { href: '/admin/pages', label: 'Сторінки', icon: FileText, section: 'Контент' },
  { href: '/admin/faq', label: 'FAQ', icon: HelpCircle, section: 'Контент' },
  { href: '/admin/email-templates', label: 'Email-шаблони', icon: Mail, section: 'Контент' },
  {
    href: '/admin/feedback',
    label: "Зворотний зв'язок",
    icon: MessageSquare,
    section: 'Контент',
    badgeKey: 'newFeedback',
  },

  // ─── Канали ─────────────────────────────────────────────────
  { href: '/admin/marketplaces', label: 'Маркетплейси', icon: Store, section: 'Канали' },
  { href: '/admin/integrations', label: 'Інтеграції', icon: Plug, section: 'Канали' },
  { href: '/admin/google-business', label: 'Google Business', icon: Star, section: 'Канали' },
  { href: '/admin/channels', label: 'Статистика каналів', icon: Radio, section: 'Канали' },
  {
    href: '/admin/channel-settings',
    label: 'Налаштування каналів',
    icon: Settings2,
    section: 'Канали',
  },
  { href: '/admin/bot-settings', label: 'Боти', icon: Bot, section: 'Канали' },
  { href: '/admin/moderation', label: 'Модерація', icon: Shield, section: 'Канали' },
  { href: '/admin/chat', label: 'Чат', icon: MessageCircle, section: 'Канали' },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook, section: 'Канали' },

  // ─── Налаштування ───────────────────────────────────────────
  { href: '/admin/settings', label: 'Загальні', icon: Settings, section: 'Налаштування' },
  {
    href: '/admin/payment-settings',
    label: 'Платіжні системи',
    icon: CreditCard,
    section: 'Налаштування',
  },
  {
    href: '/admin/delivery-settings',
    label: 'Служби доставки',
    icon: Truck,
    section: 'Налаштування',
  },
  { href: '/admin/smtp-settings', label: 'Email / SMTP', icon: AtSign, section: 'Налаштування' },
  { href: '/admin/homepage', label: 'Головна сторінка', icon: Home, section: 'Налаштування' },
  { href: '/admin/themes', label: 'Теми', icon: Palette, section: 'Налаштування' },
  { href: '/admin/seo-templates', label: 'SEO-шаблони', icon: Search, section: 'Налаштування' },
  { href: '/admin/seo-audit', label: 'SEO-аудит', icon: LineChart, section: 'Налаштування' },
  { href: '/admin/domains', label: 'Домени', icon: Globe, section: 'Налаштування' },

  // ─── Платформа (root admin only) ───────────────────────────
  {
    href: '/admin/billing',
    label: 'Біллінг',
    icon: Wallet,
    section: 'Платформа',
    platformOnly: true,
  },
  {
    href: '/admin/tenants',
    label: 'Тенанти',
    icon: Building2,
    section: 'Платформа',
    platformOnly: true,
  },
  {
    href: '/admin/health',
    label: 'Системний стан',
    icon: Activity,
    section: 'Платформа',
    platformOnly: true,
  },
  {
    href: '/admin/audit-log',
    label: 'Журнал дій',
    icon: FileSearch,
    section: 'Платформа',
    platformOnly: true,
  },
  {
    href: '/admin/feature-flags',
    label: 'Feature flags',
    icon: Flag,
    section: 'Платформа',
    platformOnly: true,
  },
  {
    href: '/admin/forecasting',
    label: 'Прогнозування',
    icon: BarChart,
    section: 'Платформа',
    platformOnly: true,
  },

  // ─── Hidden — reachable but not listed in sidebar ──────────
  // 'Ask AI' moved to topbar (next to command palette) — not part of sidebar nav.
  { href: '/admin/ask', label: 'Запитати AI', icon: Sparkles, hiddenFromSidebar: true },
  { href: '/admin/setup-2fa', label: 'Налаштування 2FA', icon: KeyRound, hiddenFromSidebar: true },
];

// Derived: { '/admin/orders': 'Замовлення', ... } for breadcrumbs.
export const PATH_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_PAGES.map((p) => [p.href, p.label]),
);

export interface NavSection {
  title?: AdminSection;
  items: AdminPage[];
}

/**
 * Grouped sections for the sidebar, preserving array order.
 * @param isPlatformAdmin - when false, items marked `platformOnly` are filtered out.
 */
export function getNavSections(isPlatformAdmin: boolean = false): NavSection[] {
  const sections = new Map<AdminSection | '_top', AdminPage[]>();
  sections.set('_top', []);
  for (const page of ADMIN_PAGES) {
    if (page.hiddenFromSidebar) continue;
    if (page.platformOnly && !isPlatformAdmin) continue;
    const key = page.section ?? '_top';
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(page);
  }

  const result: NavSection[] = [];
  const topItems = sections.get('_top') ?? [];
  if (topItems.length) result.push({ items: topItems });
  for (const sec of ADMIN_SECTIONS) {
    const items = sections.get(sec);
    if (items?.length) result.push({ title: sec, items });
  }
  return result;
}
