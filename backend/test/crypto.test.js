import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, hashToken, randomToken } from '../src/utils/crypto.js';

test('encrypted 2FA secret round-trips without exposing plaintext', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted), secret);
});

test('refresh tokens are random and hashed deterministically', () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.equal(hashToken(first), hashToken(first));
  assert.notEqual(hashToken(first), hashToken(second));
});
