/**
 * Encryption utilities for API credentials
 * Uses aes-256-gcm format (salt+iv+tag+ciphertext) - matches bot's encryption
 */
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_must_be_32_bytes_long!!';

function getKey(): Buffer {
  // Same key derivation as src/utils/encryption.ts
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

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

export function decrypt(encryptedHex: string): string {
  const key = getKey();
  const encrypted = Buffer.from(encryptedHex, 'hex');

  // Handle old CBC format (iv:ciphertext) - for backwards compatibility
  if (encryptedHex.includes(':')) {
    console.log('[Encryption] Detected old CBC format, attempting legacy decrypt...');
    const textParts = encryptedHex.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // GCM format (salt+iv+tag+ciphertext)
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
