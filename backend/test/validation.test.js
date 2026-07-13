import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, requestCreateSchema } from '../src/validation.js';

test('public registration rejects role assignment', () => {
  const result = registerSchema.safeParse({
    email: 'attacker@example.com',
    password: 'VeryStrongPassword1!',
    fullName: 'Attacker',
    role: 'admin'
  });
  assert.equal(result.success, false);
});

test('service request validation rejects negative amounts', () => {
  const result = requestCreateSchema.safeParse({
    type: 'Subscription Inquiry',
    amount: -1,
    message: 'Please process this request.'
  });
  assert.equal(result.success, false);
});
