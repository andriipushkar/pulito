// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Price = any;

export type OrderStatus =
  | 'new_order'
  | 'processing'
  | 'confirmed'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'returned';

export type ClientType = 'retail' | 'wholesale';
export type DeliveryMethod = 'nova_poshta' | 'ukrposhta' | 'pickup' | 'pallet';
export type PaymentMethod = 'cod' | 'bank_transfer' | 'online' | 'card_prepay';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';

// Order label text lives in the i18n `orderLabels` namespace (status /
// paymentStatus / deliveryMethod / paymentMethod), resolved by UI consumers via
// useTranslations('orderLabels'). These arrays give a stable iteration order for
// building filter dropdowns without a Ukrainian label map in this module.
export const ORDER_STATUSES: OrderStatus[] = [
  'new_order',
  'processing',
  'confirmed',
  'paid',
  'packed',
  'shipped',
  'completed',
  'cancelled',
  'returned',
];
export const DELIVERY_METHODS: DeliveryMethod[] = ['nova_poshta', 'ukrposhta', 'pickup', 'pallet'];
export const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'bank_transfer', 'online', 'card_prepay'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'partial', 'refunded'];

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new_order: '#2563eb',
  processing: '#d97706',
  confirmed: '#059669',
  paid: '#0891b2',
  packed: '#6366f1', // indigo — between paid (cyan) and shipped (violet)
  shipped: '#7c3aed',
  completed: '#4b5563',
  cancelled: '#dc2626',
  returned: '#ea580c',
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
  companyName: string | null;
  edrpou: string | null;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryWarehouseRef: string | null;
  deliveryStreetRef: string | null;
  deliveryBuilding: string | null;
  deliveryFlat: string | null;
  // Pallet delivery snapshot from checkout. Null for non-pallet orders.
  palletWeightKg: Price | null;
  palletRegion: string | null;
  trackingStatus: string | null;
  trackingStatusAt: string | Date | null;
  comment: string | null;
  managerComment: string | null;
  source: string;
  payment: {
    receiptUrl: string | null;
    paymentProvider: string | null;
    transactionId: string | null;
    paidAt: string | Date | null;
  } | null;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    wholesaleGroup: number | null;
  } | null;
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
