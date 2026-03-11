export type PaymentProvider = 'liqpay' | 'monobank';

export interface PaymentInitResult {
  redirectUrl: string;
  paymentId?: string;
}

export interface PaymentCallbackResult {
  orderId: number;
  status: 'success' | 'failure' | 'processing';
  transactionId: string;
  rawData: Record<string, unknown>;
  receiptUrl?: string;
}

export interface LiqPayCallbackData {
  data: string;
  signature: string;
}

export interface LiqPayDecodedData {
  action: string;
  status: string;
  order_id: string;
  payment_id: number;
  amount: number;
  currency: string;
  description: string;
  transaction_id: number;
  sender_phone?: string;
  err_code?: string;
  err_description?: string;
}

export interface MonobankCallbackData {
  invoiceId: string;
  status: string;
  amount: number;
  ccy: number;
  reference: string;
  createdDate: string;
  modifiedDate: string;
  receiptUrl?: string;
}

export interface MonobankInvoiceResponse {
  invoiceId: string;
  pageUrl: string;
}
