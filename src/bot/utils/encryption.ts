/**
 * Encryption utilities for API credentials
 * Functional style
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

let encryptionKey: Buffer | null = null;

/**
 * Initialize encryption with key
 */
export function initEncryption(key: string): void {
  if (!key || key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }
  encryptionKey = crypto.createHash('sha256').update(key).digest();
  console.log('[Encryption] ✅ Initialized');
}

/**
 * Get encryption key
 */
function getKey(): Buffer {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption() first.');
  }
  return encryptionKey;
}

/**
 * Encrypt text
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

/**
 * Decrypt text
 */
export function decrypt(encryptedHex: string): string {
  const key = getKey();
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = encrypted.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const ciphertext = encrypted.subarray(ENCRYPTED_POSITION);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
