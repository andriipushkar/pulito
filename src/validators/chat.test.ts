import { describe, it, expect } from 'vitest';
import {
  createRoomSchema,
  sendMessageSchema,
  adminChatFilterSchema,
  adminChatUpdateSchema,
} from './chat';

describe('chat validators', () => {
  describe('createRoomSchema', () => {
    it('should accept empty object (subject is optional)', () => {
      const result = createRoomSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid subject', () => {
      const result = createRoomSchema.safeParse({ subject: 'Help with order' });
      expect(result.success).toBe(true);
    });

    it('should reject subject longer than 200 characters', () => {
      const result = createRoomSchema.safeParse({ subject: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should accept empty string subject', () => {
      const result = createRoomSchema.safeParse({ subject: '' });
      expect(result.success).toBe(true);
    });
  });

  describe('sendMessageSchema', () => {
    it('should accept valid message', () => {
      const result = sendMessageSchema.safeParse({ content: 'Hello!' });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = sendMessageSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('порожнім');
      }
    });

    it('should reject message longer than 5000 characters', () => {
      const result = sendMessageSchema.safeParse({ content: 'A'.repeat(5001) });
      expect(result.success).toBe(false);
    });

    it('should accept message with optional attachment URL', () => {
      const result = sendMessageSchema.safeParse({
        content: 'See attachment',
        attachmentUrl: 'https://example.com/file.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid attachment URL', () => {
      const result = sendMessageSchema.safeParse({
        content: 'See attachment',
        attachmentUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing content', () => {
      const result = sendMessageSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('adminChatFilterSchema', () => {
    it('should accept empty object (all fields have defaults)', () => {
      const result = adminChatFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid filter params', () => {
      const result = adminChatFilterSchema.safeParse({
        page: 2,
        limit: 50,
        status: 'open',
        search: 'order',
      });
      expect(result.success).toBe(true);
    });

    it('should reject page less than 1', () => {
      const result = adminChatFilterSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = adminChatFilterSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const result = adminChatFilterSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should accept all valid statuses', () => {
      for (const status of ['open', 'assigned', 'resolved', 'closed']) {
        const result = adminChatFilterSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = adminChatFilterSchema.safeParse({ status: 'pending' });
      expect(result.success).toBe(false);
    });

    it('should reject search longer than 100 characters', () => {
      const result = adminChatFilterSchema.safeParse({ search: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers for page and limit', () => {
      const result = adminChatFilterSchema.safeParse({ page: '3', limit: '25' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(25);
      }
    });
  });

  describe('adminChatUpdateSchema', () => {
    it('should accept assign action', () => {
      const result = adminChatUpdateSchema.safeParse({ action: 'assign', agentId: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept resolve action', () => {
      const result = adminChatUpdateSchema.safeParse({ action: 'resolve' });
      expect(result.success).toBe(true);
    });

    it('should accept close action', () => {
      const result = adminChatUpdateSchema.safeParse({ action: 'close' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid action', () => {
      const result = adminChatUpdateSchema.safeParse({ action: 'delete' });
      expect(result.success).toBe(false);
    });

    it('should reject missing action', () => {
      const result = adminChatUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept agentId as optional', () => {
      const result = adminChatUpdateSchema.safeParse({ action: 'assign' });
      expect(result.success).toBe(true);
    });
  });
});
