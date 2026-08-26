/**
 * Loaded automatically by react-scripts before each test file.
 *
 * jsdom does not expose `TextEncoder`, which every browser has and `authRules.utf8Bytes` relies on
 * to measure a password the way BCrypt will. Node has the same class under `util`, so the tests
 * measure with the identical implementation the browser would use.
 */
const { TextDecoder, TextEncoder } = require('node:util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
