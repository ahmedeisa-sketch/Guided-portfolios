import express from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';
import { disableTwoFactorSchema, verifyTwoFactorSchema } from '../validation.js';

export const securityRouter = express.Router();
securityRouter.use(authenticate);

securityRouter.get('/2fa', asyncHandler(async (req, res) => {
  const result = await query('SELECT two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
  res.json({ enabled: Boolean(result.rows[0]?.two_factor_enabled) });
}));

securityRouter.post('/2fa/setup', asyncHandler(async (req, res) => {
  const status = await query('SELECT two_factor_enabled FROM users WHERE id = $1', [req.user.id]);
  if (status.rows[0]?.two_factor_enabled) {
    throw new HttpError(409, 'Disable existing 2FA before starting a new setup', 'ALREADY_ENABLED');
  }
  const secret = speakeasy.generateSecret({ length: 32, name: `EmCoin (${req.user.email})` });
  await query(
    `UPDATE users SET two_factor_secret_enc = $1, two_factor_enabled = FALSE, updated_at = NOW()
     WHERE id = $2`,
    [encryptSecret(secret.base32), req.user.id]
  );
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qrDataUrl });
}));

securityRouter.post('/2fa/verify', asyncHandler(async (req, res) => {
  const input = verifyTwoFactorSchema.parse(req.body);
  const result = await query('SELECT two_factor_secret_enc FROM users WHERE id = $1', [req.user.id]);
  const encrypted = result.rows[0]?.two_factor_secret_enc;
  if (!encrypted) throw new HttpError(400, 'Start 2FA setup first', 'SETUP_REQUIRED');

  const verified = speakeasy.totp.verify({
    secret: decryptSecret(encrypted), encoding: 'base32', token: input.token, window: 1
  });
  if (!verified) throw new HttpError(400, 'Invalid authentication code', 'INVALID_2FA');

  await query('UPDATE users SET two_factor_enabled = TRUE, updated_at = NOW() WHERE id = $1', [req.user.id]);
  await audit({ actorId: req.user.id, action: 'ENABLE_2FA', entityType: 'user', entityId: req.user.id });
  res.json({ enabled: true });
}));

securityRouter.post('/2fa/disable', asyncHandler(async (req, res) => {
  const input = disableTwoFactorSchema.parse(req.body);
  const result = await query(
    'SELECT password_hash, two_factor_secret_enc, two_factor_enabled FROM users WHERE id = $1',
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user?.two_factor_enabled || !user.two_factor_secret_enc) {
    throw new HttpError(400, '2FA is not enabled', 'NOT_ENABLED');
  }
  if (!await bcrypt.compare(input.password, user.password_hash)) {
    throw new HttpError(401, 'Invalid password', 'INVALID_CREDENTIALS');
  }
  const verified = speakeasy.totp.verify({
    secret: decryptSecret(user.two_factor_secret_enc), encoding: 'base32', token: input.token, window: 1
  });
  if (!verified) throw new HttpError(401, 'Invalid authentication code', 'INVALID_2FA');

  await query(
    `UPDATE users SET two_factor_enabled = FALSE, two_factor_secret_enc = NULL, updated_at = NOW()
     WHERE id = $1`,
    [req.user.id]
  );
  await audit({ actorId: req.user.id, action: 'DISABLE_2FA', entityType: 'user', entityId: req.user.id });
  res.json({ enabled: false });
}));
