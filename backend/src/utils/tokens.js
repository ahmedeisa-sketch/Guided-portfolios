import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, type: 'access' },
    config.jwtAccessSecret,
    { expiresIn: '15m', issuer: 'emcoin-api', audience: 'emcoin-portal' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret, {
    issuer: 'emcoin-api',
    audience: 'emcoin-portal'
  });
}

export function signTwoFactorChallenge(user) {
  return jwt.sign(
    { sub: user.id, type: '2fa-login' },
    config.jwtChallengeSecret,
    { expiresIn: '5m', issuer: 'emcoin-api', audience: 'emcoin-portal' }
  );
}

export function verifyTwoFactorChallenge(token) {
  const payload = jwt.verify(token, config.jwtChallengeSecret, {
    issuer: 'emcoin-api',
    audience: 'emcoin-portal'
  });
  if (payload.type !== '2fa-login') throw new Error('Invalid challenge token');
  return payload;
}
