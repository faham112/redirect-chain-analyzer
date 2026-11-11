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
  assert.strictEqual(isPrivateOrReserved('2a03:2880:f379:1:face:b00c:0:25de'), false);
  assert.strictEqual(isPrivateOrReserved('::1'), true);
  assert.strictEqual(isPrivateOrReserved('::'), true);
  assert.strictEqual(isPrivateOrReserved('fe80::1'), true);
  assert.strictEqual(isPrivateOrReserved('fc00::1'), true);
  assert.strictEqual(isPrivateOrReserved('::ffff:127.0.0.1'), true);
  assert.strictEqual(isPrivateOrReserved('::ffff:10.0.0.1'), true);
  assert.strictEqual(isPrivateOrReserved('::ffff:169.254.169.254'), true);
  assert.strictEqual(isPrivateOrReserved('not-an-ip'), true);
});

test('allows valid public URLs', () => {
  const u = validateUrl('https://example.com/path');
  assert.strictEqual(u.hostname, 'example.com');
});
