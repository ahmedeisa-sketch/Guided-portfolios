import express from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { query, withTransaction } from '../db.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { decryptSecret } from '../utils/crypto.js';
import { signTwoFactorChallenge, verifyTwoFactorChallenge } from '../utils/tokens.js';
import { createSession, rotateSession, revokeCurrentSession, publicUser } from '../services/session.js';
import { authenticate } from '../middleware/auth.js';
import { loginSchema, registerSchema, verifyLoginTwoFactorSchema } from '../validation.js';

export const authRouter = express.Router();

async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, email, password_hash, full_name, role, active,
            two_factor_enabled, two_factor_secret_enc
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0];
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);

  let user;
  try {
    user = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'client')
         RETURNING id, email, full_name, role`,
        [email, passwordHash, input.fullName]
      );
      const created = userResult.rows[0];
      await client.query(
        `INSERT INTO clients (user_id, client_code, risk_profile, onboarding_status)
         VALUES ($1, $2, 'Unassessed', 'Pending')`,
        [created.id, `CL-${created.id.slice(0, 8).toUpperCase()}`]
      );
      return created;
    });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'Email already registered', 'EMAIL_EXISTS');
    throw error;
  }

  await audit({ actorId: user.id, action: 'REGISTER', entityType: 'user', entityId: user.id });
  const session = await createSession(user, req, res);
  res.status(201).json(session);
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await findUserByEmail(input.email);
  const valid = user && user.active && await bcrypt.compare(input.password, user.password_hash);
  if (!valid) throw new HttpError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

  if (user.two_factor_enabled) {
    res.json({ requiresTwoFactor: true, challengeToken: signTwoFactorChallenge(user) });
    return;
  }

  await audit({ actorId: user.id, action: 'LOGIN', entityType: 'session' });
  res.json(await createSession(user, req, res));
}));

authRouter.post('/verify-2fa-login', asyncHandler(async (req, res) => {
  const input = verifyLoginTwoFactorSchema.parse(req.body);
  let challenge;
  try {
    challenge = verifyTwoFactorChallenge(input.challengeToken);
  } catch {
    throw new HttpError(401, 'Invalid or expired 2FA challenge', 'INVALID_CHALLENGE');
  }

  const result = await query(
    `SELECT id, email, full_name, role, active, two_factor_enabled, two_factor_secret_enc
     FROM users WHERE id = $1`,
    [challenge.sub]
  );
  const user = result.rows[0];
  if (!user?.active || !user.two_factor_enabled || !user.two_factor_secret_enc) {
    throw new HttpError(401, '2FA login unavailable', 'INVALID_CHALLENGE');
  }

  const verified = speakeasy.totp.verify({
    secret: decryptSecret(user.two_factor_secret_enc),
    encoding: 'base32',
    token: input.token,
    window: 1
  });
  if (!verified) throw new HttpError(401, 'Invalid authentication code', 'INVALID_2FA');

  await audit({ actorId: user.id, action: 'LOGIN_2FA', entityType: 'session' });
  res.json(await createSession(user, req, res));
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  res.json(await rotateSession(req, res));
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await revokeCurrentSession(req, res);
  res.status(204).end();
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, email, full_name, role FROM users WHERE id = $1 AND active = TRUE',
    [req.user.id]
  );
  if (!result.rows[0]) throw new HttpError(401, 'User not found', 'INVALID_USER');
  res.json({ user: publicUser(result.rows[0]) });
}));
