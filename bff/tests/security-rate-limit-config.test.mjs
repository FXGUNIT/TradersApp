import test from 'node:test';
import assert from 'node:assert/strict';

import { getRateLimitConfig } from '../services/security.mjs';

test('health-class routes use the health rate limiter bucket', () => {
  assert.equal(getRateLimitConfig('/health').name, 'health');
  assert.equal(getRateLimitConfig('/ai/status').name, 'health');
  assert.equal(getRateLimitConfig('/ml/health').name, 'health');
  assert.equal(getRateLimitConfig('/ml/status').name, 'health');
});

test('ml inference routes keep the stricter mlPredict limiter bucket', () => {
  assert.equal(getRateLimitConfig('/ml/consensus').name, 'mlPredict');
  assert.equal(getRateLimitConfig('/ml/train').name, 'mlPredict');
});
