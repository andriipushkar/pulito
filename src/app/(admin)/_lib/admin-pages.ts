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
  Rss,
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

// Section + page labels are i18n keys resolved by consumers via
// useTranslations('admin.adminNav'). Order here = order in the sidebar.
export const ADMIN_SECTIONS = [
  'section_overview',
  'section_orders',
  'section_catalog',
  'section_warehouse',
  'section_customers',
  'section_marketing',
  'section_content',
  'section_marketplaces',
  'section_social',
  'section_settings',
  'section_platform',
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
  {
    href: '/admin',
    label: 'page_dashboard',
    icon: LayoutDashboard,
    exact: true,
    section: 'section_overview',
  },
  {
    href: '/admin/analytics',
    label: 'page_analytics',
    icon: TrendingUp,
    section: 'section_overview',
  },
  { href: '/admin/reports', label: 'page_reports', icon: BarChart3, section: 'section_overview' },
  {
    href: '/admin/reports/builder',
    label: 'page_reportsBuilder',
    icon: BarChart3,
    section: 'section_overview',
  },
  {
    href: '/admin/tax-report',
    label: 'page_taxReport',
    icon: BarChart3,
    section: 'section_overview',
  },

  // ─── Замовлення ────────────────────────────────────────────
  {
    href: '/admin/orders',
    label: 'page_orders',
    icon: Package,
    badgeKey: 'newOrders',
    section: 'section_orders',
  },
  { href: '/admin/pack', label: 'page_pack', icon: ClipboardList, section: 'section_orders' },
  {
    href: '/admin/scan-sheets',
    label: 'page_scanSheets',
    icon: ClipboardList,
    section: 'section_orders',
  },
  {
    href: '/admin/pallet-delivery',
    label: 'page_palletDelivery',
    icon: Container,
    section: 'section_orders',
  },
  {
    href: '/admin/subscriptions',
    label: 'page_subscriptions',
    icon: Repeat,
    section: 'section_orders',
  },

  // ─── Каталог ───────────────────────────────────────────────
  {
    href: '/admin/products',
    label: 'page_products',
    icon: ShoppingBag,
    section: 'section_catalog',
  },
  {
    href: '/admin/categories',
    label: 'page_categories',
    icon: FolderTree,
    section: 'section_catalog',
  },
  { href: '/admin/brands', label: 'page_brands', icon: Factory, section: 'section_catalog' },
  { href: '/admin/bundles', label: 'page_bundles', icon: Boxes, section: 'section_catalog' },
  { href: '/admin/badges', label: 'page_badges', icon: Tag, section: 'section_catalog' },
  { href: '/admin/import', label: 'page_import', icon: Download, section: 'section_catalog' },

  // ─── Склад ─────────────────────────────────────────────────
  {
    href: '/admin/warehouses',
    label: 'page_warehouses',
    icon: Warehouse,
    section: 'section_warehouse',
  },
  {
    href: '/admin/stock-counts',
    label: 'page_stockCounts',
    icon: ClipboardCheck,
    section: 'section_warehouse',
  },
  {
    href: '/admin/warehouse-transfers',
    label: 'page_warehouseTransfers',
    icon: Truck,
    section: 'section_warehouse',
  },

  // ─── Клієнти ───────────────────────────────────────────────
  {
    href: '/admin/users',
    label: 'page_users',
    icon: Users,
    badgeKey: 'pendingWholesale',
    section: 'section_customers',
  },
  { href: '/admin/segments', label: 'page_segments', icon: Target, section: 'section_customers' },

  // ─── Маркетинг ─────────────────────────────────────────────
  {
    href: '/admin/campaigns',
    label: 'page_campaigns',
    icon: Megaphone,
    section: 'section_marketing',
  },
  {
    href: '/admin/volume-discounts',
    label: 'page_volumeDiscounts',
    icon: Percent,
    section: 'section_marketing',
  },
  {
    href: '/admin/personal-prices',
    label: 'page_personalPrices',
    icon: DollarSign,
    section: 'section_marketing',
  },
  {
    href: '/admin/wholesale-rules',
    label: 'page_wholesaleRules',
    icon: Briefcase,
    section: 'section_marketing',
  },
  { href: '/admin/loyalty', label: 'page_loyalty', icon: Award, section: 'section_marketing' },
  {
    href: '/admin/loyalty/challenges',
    label: 'page_loyaltyChallenges',
    icon: Flag,
    section: 'section_marketing',
  },
  { href: '/admin/referrals', label: 'page_referrals', icon: Share2, section: 'section_marketing' },
  { href: '/admin/coupons', label: 'page_coupons', icon: Tag, section: 'section_marketing' },
  { href: '/admin/banners', label: 'page_banners', icon: ImageIcon, section: 'section_marketing' },

  // ─── Контент ───────────────────────────────────────────────
  { href: '/admin/blog', label: 'page_blog', icon: Newspaper, section: 'section_content' },
  {
    href: '/admin/blog/categories',
    label: 'page_blogCategories',
    icon: FolderTree,
    section: 'section_content',
  },
  {
    href: '/admin/blog/comments',
    label: 'page_blogComments',
    icon: MessageCircle,
    section: 'section_content',
  },
  { href: '/admin/pages', label: 'page_pages', icon: FileText, section: 'section_content' },
  { href: '/admin/faq', label: 'page_faq', icon: HelpCircle, section: 'section_content' },
  {
    href: '/admin/faq/categories',
    label: 'page_faqCategories',
    icon: FolderTree,
    section: 'section_content',
  },
  {
    href: '/admin/email-templates',
    label: 'page_emailTemplates',
    icon: Mail,
    section: 'section_content',
  },
  {
    href: '/admin/feedback',
    label: 'page_feedback',
    icon: MessageSquare,
    section: 'section_content',
    badgeKey: 'newFeedback',
  },

  // ─── Маркетплейси ───────────────────────────────────────────
  // Тільки те що про продажі на сторонніх торгових платформах.
  {
    href: '/admin/marketplaces',
    label: 'page_marketplaces',
    icon: Store,
    section: 'section_marketplaces',
  },
  { href: '/admin/feeds', label: 'page_feeds', icon: Rss, section: 'section_marketplaces' },
  {
    href: '/admin/integrations',
    label: 'page_integrations',
    icon: Plug,
    section: 'section_marketplaces',
  },
  {
    href: '/admin/webhooks',
    label: 'page_webhooks',
    icon: Webhook,
    section: 'section_marketplaces',
  },

  // ─── Соцмережі ──────────────────────────────────────────────
  // Контент, комунікація з клієнтами, репутація в соцмережах.
  { href: '/admin/channels', label: 'page_channels', icon: Radio, section: 'section_social' },
  {
    href: '/admin/channel-settings',
    label: 'page_channelSettings',
    icon: Settings2,
    section: 'section_social',
  },
  { href: '/admin/bot-settings', label: 'page_botSettings', icon: Bot, section: 'section_social' },
  {
    href: '/admin/publications',
    label: 'page_publications',
    icon: Send,
    section: 'section_social',
  },
  {
    href: '/admin/publication-templates',
    label: 'page_publicationTemplates',
    icon: FileText,
    section: 'section_social',
  },
  { href: '/admin/chat', label: 'page_chat', icon: MessageCircle, section: 'section_social' },
  {
    href: '/admin/google-business',
    label: 'page_googleBusiness',
    icon: Star,
    section: 'section_social',
  },
  { href: '/admin/moderation', label: 'page_moderation', icon: Shield, section: 'section_social' },

  // ─── Налаштування ───────────────────────────────────────────
  { href: '/admin/settings', label: 'page_settings', icon: Settings, section: 'section_settings' },
  {
    href: '/admin/payment-settings',
    label: 'page_paymentSettings',
    icon: CreditCard,
    section: 'section_settings',
  },
  {
    href: '/admin/delivery-settings',
    label: 'page_deliverySettings',
    icon: Truck,
    section: 'section_settings',
  },
  {
    href: '/admin/smtp-settings',
    label: 'page_smtpSettings',
    icon: AtSign,
    section: 'section_settings',
  },
  { href: '/admin/homepage', label: 'page_homepage', icon: Home, section: 'section_settings' },
  { href: '/admin/themes', label: 'page_themes', icon: Palette, section: 'section_settings' },
  {
    href: '/admin/seo-templates',
    label: 'page_seoTemplates',
    icon: Search,
    section: 'section_settings',
  },
  {
    href: '/admin/seo-audit',
    label: 'page_seoAudit',
    icon: LineChart,
    section: 'section_settings',
  },
  {
    href: '/admin/not-found-log',
    label: 'page_notFoundLog',
    icon: Search,
    section: 'section_settings',
  },
  { href: '/admin/domains', label: 'page_domains', icon: Globe, section: 'section_settings' },

  // ─── Платформа (root admin only) ───────────────────────────
  {
    href: '/admin/billing',
    label: 'page_billing',
    icon: Wallet,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/tenants',
    label: 'page_tenants',
    icon: Building2,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/health',
    label: 'page_health',
    icon: Activity,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/audit-log',
    label: 'page_auditLog',
    icon: FileSearch,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/feature-flags',
    label: 'page_featureFlags',
    icon: Flag,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/forecasting',
    label: 'page_forecasting',
    icon: BarChart,
    section: 'section_platform',
    platformOnly: true,
  },
  {
    href: '/admin/search-intel',
    label: 'page_searchIntel',
    icon: BarChart,
    section: 'section_platform',
    platformOnly: true,
  },

  // ─── Hidden — reachable but not listed in sidebar ──────────
  // 'Ask AI' moved to topbar (next to command palette) — not part of sidebar nav.
  { href: '/admin/ask', label: 'page_ask', icon: Sparkles, hiddenFromSidebar: true },
  { href: '/admin/setup-2fa', label: 'page_setup2fa', icon: KeyRound, hiddenFromSidebar: true },
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
