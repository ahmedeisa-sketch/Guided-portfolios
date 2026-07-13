import crypto from 'node:crypto';
import { config } from '../config.js';

export function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.twoFactorEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload) {
  const [ivPart, tagPart, encryptedPart] = String(payload).split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid encrypted secret');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    config.twoFactorEncryptionKey,
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
