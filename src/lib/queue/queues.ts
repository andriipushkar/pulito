import { Queue } from 'bullmq';
import { queueConnection } from './connection';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface PushJobData {
  userId: number;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface PdfJobData {
  type: 'retail' | 'wholesale';
  categoryId?: number;
  requestedBy?: number;
}

export interface MarketplaceSyncJobData {
  platform: 'rozetka' | 'prom';
  syncType: 'products' | 'prices' | 'stock' | 'orders';
}

// Queue instances — lazy-initialized singletons
let _emailQueue: Queue<EmailJobData> | null = null;
let _pushQueue: Queue<PushJobData> | null = null;
let _pdfQueue: Queue<PdfJobData> | null = null;
let _marketplaceSyncQueue: Queue<MarketplaceSyncJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!_emailQueue) {
    _emailQueue = new Queue('email', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _emailQueue;
}

export function getPushQueue(): Queue<PushJobData> {
  if (!_pushQueue) {
    _pushQueue = new Queue('push', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2000 },
      },
    });
  }
  return _pushQueue;
}

export function getPdfQueue(): Queue<PdfJobData> {
  if (!_pdfQueue) {
    _pdfQueue = new Queue('pdf', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _pdfQueue;
}

export function getMarketplaceSyncQueue(): Queue<MarketplaceSyncJobData> {
  if (!_marketplaceSyncQueue) {
    _marketplaceSyncQueue = new Queue('marketplace-sync', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return _marketplaceSyncQueue;
}
