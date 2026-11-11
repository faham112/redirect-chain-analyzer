const { test } = require('node:test');
const assert = require('node:assert');
const { validateUrl, isPrivateOrReserved } = require('../src/services/security');

test('rejects non-http protocols', () => {
  assert.throws(() => validateUrl('ftp://example.com'), /Only HTTP and HTTPS/);
  assert.throws(() => validateUrl('file:///etc/passwd'), /Only HTTP and HTTPS/);
});

test('rejects invalid URLs', () => {
  assert.throws(() => validateUrl('not-a-url'), /Invalid URL/);
  assert.throws(() => validateUrl(''), /required/);
});

test('blocks private IP ranges', () => {
  assert.strictEqual(isPrivateOrReserved('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrReserved('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrReserved('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrReserved('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrReserved('169.254.169.254'), true);
  assert.strictEqual(isPrivateOrReserved('8.8.8.8'), false);
});

test('allows valid public URLs', () => {
  const u = validateUrl('https://example.com/path');
  assert.strictEqual(u.hostname, 'example.com');
});
