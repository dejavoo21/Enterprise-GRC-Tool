import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSecuritySecret } from '../services/securityConfiguration.js';

test('production requires explicit strong authentication secrets', () => {
  assert.throws(() => resolveSecuritySecret('JWT_SECRET', { NODE_ENV: 'production' }), /required/);
  assert.throws(() => resolveSecuritySecret('MFA_ENCRYPTION_KEY', { NODE_ENV: 'production', MFA_ENCRYPTION_KEY: 'short' }), /32 characters/);
  assert.equal(resolveSecuritySecret('JWT_SECRET', { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }), 'x'.repeat(32));
});

test('development compatibility defaults do not apply to production', () => {
  assert.match(resolveSecuritySecret('JWT_SECRET', { NODE_ENV: 'development' }), /dev-secret/);
});
