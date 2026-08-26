/**
 * Mirrors of the server's account rules, so a bad password is caught before it costs a round trip —
 * and before it spends one of the ten authentication attempts the server allows per minute.
 *
 * These match `AuthService.requirePassword` and the `RegisterRequest` annotations. Note the two
 * different units: the length floor counts characters (Java's `String.length()`), while the ceiling
 * counts UTF-8 bytes, which is what BCrypt actually consumes. A Chinese character is one of the
 * former and three of the latter, so measuring both in characters would let a long passphrase
 * through and have the server reject it instead.
 *
 * Each check answers with the semantic code the server itself would have sent, so the form renders
 * a predicted failure through exactly the same path as a real one.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 64;
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
export const PASSWORD_MIN_CHARS = 12;
export const PASSWORD_MAX_BYTES = 72;
export const DISPLAY_NAME_MAX = 100;

/**
 * The server sends `{code, params}` and currently leaves `params` empty for these three, so the
 * numbers below fill the placeholders in the dictionaries. Server-sent params take precedence: the
 * day the backend starts sending `{min: 12}`, these stop being consulted and the copy follows the
 * server's real rule with no frontend change.
 */
export const RULE_PARAMS = {
  'error.usernameRules': { min: USERNAME_MIN, max: USERNAME_MAX },
  'error.passwordRules': { min: PASSWORD_MIN_CHARS, max: PASSWORD_MAX_BYTES },
  'error.displayNameRules': { max: DISPLAY_NAME_MAX },
};

export function utf8Bytes(value) {
  return new TextEncoder().encode(value ?? '').length;
}

/** Empty is not this function's business — the form's `required` rule speaks for that. */
const skipEmpty = (value) => value === undefined || value === null || value === '';

export function checkUsername(value) {
  if (skipEmpty(value)) return null;
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) return 'error.usernameRules';
  if (!USERNAME_PATTERN.test(value)) return 'error.usernameRules';
  return null;
}

export function checkPassword(value) {
  if (skipEmpty(value)) return null;
  // Deliberately the same two comparisons, in the same order, as AuthService.requirePassword.
  if (value.length < PASSWORD_MIN_CHARS) return 'error.passwordRules';
  if (utf8Bytes(value) > PASSWORD_MAX_BYTES) return 'error.passwordRules';
  return null;
}

export function checkDisplayName(value) {
  if (skipEmpty(value)) return null;
  if (value.length > DISPLAY_NAME_MAX) return 'error.displayNameRules';
  return null;
}
