import { Worker } from 'bullmq';
import { queueConnection } from './connection';
import { logger } from '@/lib/logger';
import type { EmailJobData, PushJobData, PdfJobData, MarketplaceSyncJobData } from './queues';

/**
 * Create and start all BullMQ workers.
 * Call this once at application startup (e.g., in instrumentation.ts or a dedicated worker process).
 */
export function startWorkers() {
  const emailWorker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      // Dynamic import to avoid loading nodemailer at module level
      const { sendEmail } = await import('@/services/email');
      await sendEmail({
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
        from: job.data.from,
        replyTo: job.data.replyTo,
      });
      logger.info('Email sent via queue', { jobId: job.id, to: job.data.to });
    },
    {
      connection: queueConnection,
      concurrency: 5,
    },
  );

  const pushWorker = new Worker<PushJobData>(
    'push',
    async (job) => {
      const { sendPushNotification } = await import('@/services/push');
      await sendPushNotification(job.data.userId, {
        title: job.data.title,
        body: job.data.body,
        url: job.data.url,
        icon: job.data.icon,
      });
      logger.info('Push notification sent via queue', { jobId: job.id, userId: job.data.userId });
    },
    {
      connection: queueConnection,
      concurrency: 10,
    },
  );

  const pdfWorker = new Worker<PdfJobData>(
    'pdf',
    async (job) => {
      const { generatePriceList } = await import('@/services/pdf-catalog');
      const filePath = await generatePriceList({
        type: job.data.type,
        categoryId: job.data.categoryId,
      });
      logger.info('PDF generated via queue', { jobId: job.id, filePath });
      return filePath;
    },
    {
      connection: queueConnection,
      concurrency: 2, // PDF generation is CPU-intensive
    },
  );

  const marketplaceSyncWorker = new Worker<MarketplaceSyncJobData>(
    'marketplace-sync',
    async (job) => {
      const { syncProductsToMarketplace } = await import('@/services/marketplace-sync');
      const result = await syncProductsToMarketplace(job.data.platform);
      logger.info('Marketplace sync completed via queue', {
        jobId: job.id,
        platform: job.data.platform,
        result,
      });
      return result;
    },
    {
      connection: queueConnection,
      concurrency: 1, // One marketplace sync at a time
    },
  );

  // Error handling for all workers
  const workers = [emailWorker, pushWorker, pdfWorker, marketplaceSyncWorker];
  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error(`Queue job failed: ${worker.name}`, {
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
      });
    });
  }

  logger.info('BullMQ workers started', {
    queues: ['email', 'push', 'pdf', 'marketplace-sync'],
  });

  return { emailWorker, pushWorker, pdfWorker, marketplaceSyncWorker };
}
