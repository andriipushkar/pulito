import QRCode from 'qrcode';
import { env } from '@/config/env';

export class QRCodeError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'QRCodeError';
  }
}

export async function generateQRCode(text: string): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(text, {
      type: 'png',
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  } catch {
    throw new QRCodeError('Помилка генерації QR-коду');
  }
}

export async function generateOrderQR(orderNumber: string): Promise<Buffer> {
  const url = `${env.APP_URL}/account/orders?search=${encodeURIComponent(orderNumber)}`;
  return generateQRCode(url);
}

export async function generatePaymentQR(orderId: number, amount: number): Promise<Buffer> {
  const text = `${env.APP_URL}/payment/${orderId}?amount=${amount}`;
  return generateQRCode(text);
}

/** Generate QR code that links to reorder page */
export async function generateReorderQR(orderId: number): Promise<Buffer> {
  const url = `${env.APP_URL}/reorder/${orderId}`;
  return generateQRCode(url);
}
