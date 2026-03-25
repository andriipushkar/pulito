import { ConnectionOptions } from 'bullmq';

/**
 * Shared BullMQ Redis connection options.
 * Uses the same Redis instance as the rest of the application.
 */
export const queueConnection: ConnectionOptions = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6380/0').hostname,
  port: Number(new URL(process.env.REDIS_URL || 'redis://localhost:6380/0').port) || 6379,
};
