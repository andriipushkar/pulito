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
  wholesaler: 'Оптовик',
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
}

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
  };
  topProducts: { name: string; quantity: number }[];
}
