import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * TOTP implementation (RFC 6238) without external dependencies.
 * Time step: 30 seconds, digits: 6, algorithm: SHA1.
 */

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_WINDOW = 1; // ±1 step for clock skew

// ─────────────────────────────────────
// Base32 encode/decode (RFC 4648)
// ─────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[=\s]/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

// ─────────────────────────────────────
// HOTP / TOTP core
// ─────────────────────────────────────

function generateHOTP(secret: Buffer, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(counter);

  const hmac = createHmac('sha1', secret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return (code % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Generate a random 20-byte secret, returned as a base32-encoded string.
 */
export function generateSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Generate the current TOTP code for a given secret.
 */
export function generateTOTP(secret: string): string {
  const time = BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD));
  return generateHOTP(base32Decode(secret), time);
}

/**
 * Verify a TOTP token against a secret.
 * Allows ±1 time-step window for clock skew.
 */
export function verifyTOTP(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const time = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  const secretBuffer = base32Decode(secret);
  let valid = false;

  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const code = generateHOTP(secretBuffer, BigInt(time + i));
    if (timingSafeEqual(Buffer.from(code), Buffer.from(token))) {
      valid = true;
    }
  }

  return valid;
}

/**
 * Generate an otpauth:// URL suitable for QR code generation in authenticator apps.
 */
/**
 * Generate a set of one-time backup codes for 2FA recovery.
 */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(4).toString('hex'));
}

/**
 * Hash a backup code for safe storage.
 */
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function generateOtpauthUrl(secret: string, email: string): string {
  const issuer = 'Порошок';
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}
