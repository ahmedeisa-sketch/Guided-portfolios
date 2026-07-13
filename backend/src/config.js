import 'dotenv/config';
import crypto from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function strongSecret(name, fallback) {
  const value = required(name, fallback);
  if (isProduction && value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production`);
  }
  return value;
}

const encryptionInput = required(
  'TWO_FACTOR_ENCRYPTION_KEY',
  isProduction ? undefined : 'development-only-two-factor-key'
);

const encryptionKey = /^[a-fA-F0-9]{64}$/.test(encryptionInput)
  ? Buffer.from(encryptionInput, 'hex')
  : crypto.createHash('sha256').update(encryptionInput).digest();

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 5000),
  databaseUrl: required(
    'DATABASE_URL',
    'postgres://emcoin:emcoin@localhost:5432/emcoin'
  ),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  jwtAccessSecret: strongSecret(
    'JWT_ACCESS_SECRET',
    isProduction ? undefined : 'development-access-secret-change-me-now'
  ),
  jwtChallengeSecret: strongSecret(
    'JWT_CHALLENGE_SECRET',
    isProduction ? undefined : 'development-challenge-secret-change-me'
  ),
  twoFactorEncryptionKey: encryptionKey,
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'em_refresh',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  trustProxy: process.env.TRUST_PROXY === 'true'
});
