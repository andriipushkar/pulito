import type { Meta, StoryObj } from '@storybook/react';
import PrintableOrder from './PrintableOrder';
import type { OrderDetail } from '@/types/order';

const mockOrder: OrderDetail = {
  id: 1,
  orderNumber: 'ORD-2025-001',
  status: 'confirmed',
  clientType: 'retail',
  totalAmount: 1350,
  itemsCount: 3,
  contactName: 'Ivan Petrenko',
  contactPhone: '+380501234567',
  contactEmail: 'ivan@example.com',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  deliveryMethod: 'nova_poshta',
  trackingNumber: '20450000123456',
  createdAt: '2025-12-01T10:30:00Z',
  userId: 1,
  assignedManagerId: null,
  discountAmount: 50,
  deliveryCost: 80,
  deliveryCity: 'Kyiv',
  deliveryAddress: 'Warehouse #5',
  deliveryWarehouseRef: null,
  comment: 'Please deliver before 5pm',
  managerComment: null,
  source: 'web',
  payment: null,
  user: {
    id: 1,
    fullName: 'Ivan Petrenko',
    email: 'ivan@example.com',
    role: 'customer',
    wholesaleGroup: null,
  },
  items: [
    {
      id: 1,
      productId: 1,
      productCode: 'P001',
      productName: 'Premium Powder 5kg',
      priceAtOrder: 450,
      quantity: 2,
      subtotal: 900,
      isPromo: false,
    },
    {
      id: 2,
      productId: 2,
      productCode: 'P002',
      productName: 'Glass Cleaner 750ml',
      priceAtOrder: 120,
      quantity: 1,
      subtotal: 120,
      isPromo: false,
    },
  ],
  statusHistory: [
    {
      id: 1,
      oldStatus: null,
      newStatus: 'new_order',
      changeSource: 'system',
      comment: null,
      createdAt: '2025-12-01T10:30:00Z',
    },
    {
      id: 2,
      oldStatus: 'new_order',
      newStatus: 'confirmed',
      changeSource: 'admin',
      comment: null,
      createdAt: '2025-12-01T11:00:00Z',
    },
  ],
};

const meta: Meta<typeof PrintableOrder> = {
  title: 'Order/PrintableOrder',
  component: PrintableOrder,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof PrintableOrder>;

export const Default: Story = {
  args: { order: mockOrder },
};
