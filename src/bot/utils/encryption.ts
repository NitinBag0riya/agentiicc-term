import * as crypto from 'crypto';

// In production, this should be in .env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_must_be_32_bytes_long!!'; 
const IV_LENGTH = 16; 

export function encrypt(text: string): string {
  // Use a fixed key for MVP/POC. 
  // Ensure key is 32 bytes
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
