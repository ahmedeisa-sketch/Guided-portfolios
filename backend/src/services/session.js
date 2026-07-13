import { config } from '../config.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { signAccessToken } from '../utils/tokens.js';
import { HttpError } from '../utils/http.js';
import { withTransaction, query } from '../db.js';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000
  };
}

export function publicUser(user) {
  return { id: user.id, email: user.email, fullName: user.full_name, role: user.role };
}

async function insertRefreshToken(client, userId, token, req) {
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 86_400_000);
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hashToken(token), expiresAt, req.get('user-agent') || null, req.ip || null]
  );
}

export async function createSession(user, req, res) {
  const refreshToken = randomToken();
  await withTransaction((client) => insertRefreshToken(client, user.id, refreshToken, req));
  res.cookie(config.refreshCookieName, refreshToken, cookieOptions());
  return { accessToken: signAccessToken(user), user: publicUser(user) };
}

export async function rotateSession(req, res) {
  const rawToken = req.cookies?.[config.refreshCookieName];
  if (!rawToken) throw new HttpError(401, 'Refresh token missing', 'REFRESH_REQUIRED');

  const result = await withTransaction(async (client) => {
    const tokenResult = await client.query(
      `SELECT rt.*, u.email, u.full_name, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       FOR UPDATE`,
      [hashToken(rawToken)]
    );
    const existing = tokenResult.rows[0];
    if (!existing) throw new HttpError(401, 'Invalid refresh token', 'INVALID_REFRESH');

    if (existing.revoked_at) {
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1',
        [existing.user_id]
      );
      return { error: new HttpError(401, 'Refresh token reuse detected', 'TOKEN_REUSE') };
    }

    if (!existing.active || new Date(existing.expires_at) <= new Date()) {
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [existing.id]);
      return { error: new HttpError(401, 'Refresh token expired', 'REFRESH_EXPIRED') };
    }

    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [existing.id]);
    const replacement = randomToken();
    await insertRefreshToken(client, existing.user_id, replacement, req);

    return {
      replacement,
      user: {
        id: existing.user_id,
        email: existing.email,
        full_name: existing.full_name,
        role: existing.role
      }
    };
  });

  if (result.error) throw result.error;
  res.cookie(config.refreshCookieName, result.replacement, cookieOptions());
  return { accessToken: signAccessToken(result.user), user: publicUser(result.user) };
}

export async function revokeCurrentSession(req, res) {
  const rawToken = req.cookies?.[config.refreshCookieName];
  if (rawToken) {
    await query(
      'UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = $1',
      [hashToken(rawToken)]
    );
  }
  res.clearCookie(config.refreshCookieName, { ...cookieOptions(), maxAge: undefined });
}
