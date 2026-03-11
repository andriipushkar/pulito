import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.SMTP_HOST = 'smtp.test.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@test.com';
  process.env.SMTP_PASS = 'password';
  process.env.SMTP_FROM = '"Clean Shop" <noreply@clean-shop.ua>';
  process.env.APP_URL = 'http://localhost:3000';
});

const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: (...args: unknown[]) => mockSendMail(...args),
    }),
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'password',
    SMTP_FROM: '"Clean Shop" <noreply@clean-shop.ua>',
    APP_URL: 'http://localhost:3000',
  },
}));

import { sendEmail, sendVerificationEmail, sendPasswordResetEmail, EmailError } from './email';
import { env } from '@/config/env';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EmailError', () => {
  it('should create an EmailError with default status code', () => {
    const error = new EmailError('test error');
    expect(error.message).toBe('test error');
    expect(error.name).toBe('EmailError');
    expect(error.statusCode).toBe(500);
    expect(error.originalError).toBeUndefined();
  });

  it('should create an EmailError with custom status code and original error', () => {
    const original = new Error('original');
    const error = new EmailError('wrapped error', 503, original);
    expect(error.statusCode).toBe(503);
    expect(error.originalError).toBe(original);
  });

  it('should be an instance of Error', () => {
    const error = new EmailError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('sendEmail', () => {
  it('should send email successfully on first attempt', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<msg-123@test.com>' });

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result).toEqual({
      success: true,
      messageId: '<msg-123@test.com>',
      attempts: 1,
    });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Clean Shop" <noreply@clean-shop.ua>',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      })
    );
  });

  it('should send email with attachments', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<msg-456@test.com>' });

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'With Attachment',
      html: '<p>See attached</p>',
      attachments: [
        {
          filename: 'invoice.pdf',
          content: Buffer.from('pdf-data'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'invoice.pdf',
            content: Buffer.from('pdf-data'),
            contentType: 'application/pdf',
          },
        ],
      })
    );
  });

  it('should retry on failure and succeed on second attempt', async () => {
    mockSendMail
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({ messageId: '<msg-retry@test.com>' });

    // Use baseDelay=0 to avoid waiting in tests
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Retry Test',
      html: '<p>Retry</p>',
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it('should retry up to 3 times then throw EmailError', async () => {
    const transportError = new Error('SMTP connection failed');
    mockSendMail.mockRejectedValue(transportError);

    try {
      await sendEmail({
        to: 'user@example.com',
        subject: 'Fail Test',
        html: '<p>Fail</p>',
      });
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
      expect((error as EmailError).message).toBe('SMTP connection failed');
    }
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });

  it('should pass undefined attachments when none provided', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<msg-no-attach@test.com>' });

    await sendEmail({
      to: 'user@example.com',
      subject: 'No Attachments',
      html: '<p>No attach</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: undefined,
      })
    );
  });

  it('should use fallback from when SMTP_FROM is not set', async () => {
    const original = env.SMTP_FROM;
    (env as any).SMTP_FROM = '';
    mockSendMail.mockResolvedValue({ messageId: '<msg-fallback@test.com>' });

    await sendEmail({
      to: 'user@example.com',
      subject: 'Fallback From',
      html: '<p>Test</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Порошок" <test@test.com>',
      })
    );
    (env as any).SMTP_FROM = original;
  });

  it('should handle non-Error thrown objects', async () => {
    mockSendMail.mockRejectedValue('string error');

    try {
      await sendEmail({
        to: 'user@example.com',
        subject: 'Non-Error',
        html: '<p>Test</p>',
      });
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
      expect((error as EmailError).message).toBe('Невідома помилка відправки email');
    }
  });
});

describe('sendVerificationEmail', () => {
  it('should send verification email with correct URL and content', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<verification@test.com>' });

    await sendVerificationEmail('user@example.com', 'abc-token-123');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toContain('Підтвердіть ваш email');
    expect(callArgs.html).toContain('http://localhost:3000/auth/verify-email?token=abc-token-123');
    expect(callArgs.html).toContain('Підтвердження email');
  });

  it('should propagate errors as EmailError', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

    try {
      await sendVerificationEmail('user@example.com', 'token');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
    }
  });
});

describe('sendPasswordResetEmail', () => {
  it('should send password reset email with correct URL and content', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<reset@test.com>' });

    await sendPasswordResetEmail('user@example.com', 'reset-token-456');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.subject).toContain('Відновлення пароля');
    expect(callArgs.html).toContain('http://localhost:3000/auth/reset-password?token=reset-token-456');
    expect(callArgs.html).toContain('Відновлення пароля');
  });

  it('should propagate errors as EmailError', async () => {
    mockSendMail.mockRejectedValue(new Error('Connection refused'));

    try {
      await sendPasswordResetEmail('user@example.com', 'token');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailError);
    }
  });
});
