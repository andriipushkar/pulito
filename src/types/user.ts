export type UserRole = 'client' | 'wholesaler' | 'manager' | 'admin';
export type WholesaleStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type WholesaleGroup = 1 | 2 | 3;

export const WHOLESALE_GROUP_LABELS: Record<WholesaleGroup, string> = {
  1: 'Дрібний опт',
  2: 'Середній опт',
  3: 'Великий опт',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  client: 'Клієнт',
  wholesaler: 'Гуртівник',
  manager: 'Менеджер',
  admin: 'Адміністратор',
};

export const WHOLESALE_STATUS_LABELS: Record<WholesaleStatus, string> = {
  none: '—',
  pending: 'Очікує',
  approved: 'Підтверджено',
  rejected: 'Відхилено',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Вхід',
  logout: 'Вихід',
  role_change: 'Зміна ролі',
  import_action: 'Імпорт',
  order_status_change: 'Зміна статусу замовлення',
  publication_create: 'Створення публікації',
  theme_change: 'Зміна теми',
  page_edit: 'Редагування сторінки',
  rule_change: 'Зміна правил',
  data_delete: 'Видалення даних',
  user_block: 'Блокування',
  user_unblock: 'Розблокування',
  user_edit: 'Редагування профілю',
  password_reset: 'Скидання пароля',
  wholesale_approve: 'Підтвердження опт. запиту',
  wholesale_reject: 'Відхилення опт. запиту',
};

export interface UserListItem {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  companyName: string | null;
  edrpou: string | null;
  wholesaleStatus: WholesaleStatus;
  wholesaleGroup: WholesaleGroup | null;
  wholesaleRequestDate: string | Date | null;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: string | Date;
  _count: { orders: number };
}

export interface UserDetail extends UserListItem {
  legalAddress: string | null;
  bankIban: string | null;
  bankName: string | null;
  bankMfo: string | null;
  ownershipType: string | null;
  taxSystem: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  wholesaleApprovedDate: string | null;
  wholesaleMonthlyVol: string | null;
  assignedManager: { id: number; fullName: string; email: string } | null;
  notificationPrefs: unknown;
  avatarUrl: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  adminNote: string | null;
  updatedAt: string;
}

export interface UserStats {
  totalOrders: number;
  completedOrders: number;
  totalPurchases: number;
  avgCheck: number;
  lastOrderDate: string | null;
  firstOrderDate?: string | null;
  daysSinceLastOrder?: number | null;
  predictedLtv12mo?: number;
  segments?: string[];
}

export interface UserTimelineEntry {
  id: string;
  kind: 'order' | 'review' | 'audit' | 'event';
  at: string;
  title: string;
  body?: string;
  href?: string;
}

export const SEGMENT_LABELS: Record<string, { label: string; color: string }> = {
  vip: { label: 'VIP', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  loyal: { label: 'Лояльний', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  new: { label: 'Новий', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'one-time': { label: 'Разовий', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'at-risk': { label: 'У ризику', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  churned: { label: 'Втрачений', color: 'bg-red-100 text-red-700 border-red-200' },
  'no-orders': { label: 'Без замовлень', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export interface UserAuditEntry {
  id: number;
  actionType: string;
  entityType: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: number; fullName: string } | null;
}

export interface UserOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string;
  itemsCount: number;
  createdAt: string;
  paymentStatus: string;
}

export interface WishlistItem {
  id: number;
  product: {
    id: number;
    slug: string;
    name: string;
    price: number;
    imageUrl: string | null;
    inStock: boolean;
  };
  createdAt: string;
}

export interface RecentlyViewedItem {
  id: number;
  product: {
    id: number;
    slug: string;
    name: string;
    price: number;
    imageUrl: string | null;
  };
  viewedAt: string;
}

export interface UserAddress {
  id: number;
  label: string | null;
  city: string;
  street: string | null;
  building: string | null;
  apartment: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface DashboardStats {
  orders: {
    todayCount: number;
    todayRevenue: number;
    yesterdayCount: number;
    yesterdayRevenue: number;
    newCount: number;
  };
  users: {
    total: number;
    wholesalers: number;
    newThisWeek: number;
    pendingWholesale: number;
  };
  products: {
    total: number;
    outOfStock: number;
    lowStock: number;
    withoutBarcode?: number;
  };
  topProducts: { id: number | null; name: string; slug: string | null; quantity: number }[];
  recentOrders: {
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    contactName: string;
    createdAt: string;
  }[];
  weeklyRevenue: { date: string; revenue: number; count: number }[];
  hourlyToday: { hour: number; count: number; revenue: number }[];
}
