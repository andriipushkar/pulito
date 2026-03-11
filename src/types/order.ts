// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Price = any;

export type OrderStatus =
  | 'new_order'
  | 'processing'
  | 'confirmed'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'returned';

export type ClientType = 'retail' | 'wholesale';
export type DeliveryMethod = 'nova_poshta' | 'ukrposhta' | 'pickup' | 'pallet';
export type PaymentMethod = 'cod' | 'bank_transfer' | 'online' | 'card_prepay';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new_order: 'Нове',
  processing: 'В обробці',
  confirmed: 'Підтверджене',
  paid: 'Оплачене',
  shipped: 'Відправлене',
  completed: 'Виконане',
  cancelled: 'Скасоване',
  returned: 'Повернення',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new_order: '#2563eb',
  processing: '#d97706',
  confirmed: '#059669',
  paid: '#0891b2',
  shipped: '#7c3aed',
  completed: '#4b5563',
  cancelled: '#dc2626',
  returned: '#ea580c',
};

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  pickup: 'Самовивіз',
  pallet: 'Палетна доставка',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Накладений платіж',
  bank_transfer: 'На розрахунковий рахунок',
  online: 'Онлайн-оплата',
  card_prepay: 'Передоплата на картку',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Очікує оплати',
  paid: 'Оплачено',
  partial: 'Часткова оплата',
  refunded: 'Повернення коштів',
};

export interface OrderItemData {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  priceAtOrder: number;
  quantity: number;
  subtotal: number;
  isPromo: boolean;
  imagePath?: string | null;
}

export interface OrderListItem {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  clientType: ClientType;
  totalAmount: Price;
  itemsCount: number;
  contactName: string;
  contactPhone: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryMethod: DeliveryMethod;
  trackingNumber: string | null;
  createdAt: string | Date;
}

export interface OrderDetail extends OrderListItem {
  userId: number | null;
  assignedManagerId: number | null;
  discountAmount: Price;
  deliveryCost: Price;
  contactEmail: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryWarehouseRef: string | null;
  comment: string | null;
  managerComment: string | null;
  source: string;
  payment: {
    receiptUrl: string | null;
    paymentProvider: string | null;
    transactionId: string | null;
    paidAt: string | Date | null;
  } | null;
  user: { id: number; fullName: string; email: string; role: string; wholesaleGroup: number | null } | null;
  items: OrderItemData[];
  statusHistory: {
    id: number;
    oldStatus: string | null;
    newStatus: string;
    changeSource: string;
    comment: string | null;
    createdAt: string | Date;
  }[];
}

export interface CartItemServer {
  id: number;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    slug: string;
    code: string;
    priceRetail: Price;
    priceWholesale: Price | null;
    quantity: number;
    isPromo: boolean;
    imagePath: string | null;
    images: { pathThumbnail: string | null }[];
  };
}
