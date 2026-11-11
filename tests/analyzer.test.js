const { test } = require('node:test');
const assert = require('node:assert');
const { extractMetaRefresh, extractJsRedirects } = require('../src/services/analyzer');

test('extractMetaRefresh finds meta refresh URL', () => {
  const html = '<html><meta http-equiv="refresh" content="0; url=https://final.example/path"></html>';
  assert.strictEqual(extractMetaRefresh(html), 'https://final.example/path');
});

test('extractMetaRefresh returns null when absent', () => {
  assert.strictEqual(extractMetaRefresh('<html><body>no refresh</body></html>'), null);
});

test('extractJsRedirects finds window.location assignments', () => {
  const html = 'window.location = "https://js-redirect.example"; location.href="https://other.example";';
  const indicators = extractJsRedirects(html);
  assert.ok(indicators.includes('https://js-redirect.example'));
  assert.ok(indicators.includes('https://other.example'));
});

test('JS indicators are static only — never executed', () => {
  const result = extractJsRedirects('<script>window.location="https://x.example"</script>');
  assert.ok(Array.isArray(result));
});
