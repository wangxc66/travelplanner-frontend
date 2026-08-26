import {
  DISPLAY_NAME_MAX,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_CHARS,
  USERNAME_MAX,
  USERNAME_MIN,
  checkDisplayName,
  checkPassword,
  checkUsername,
  utf8Bytes,
} from './authRules';

const repeat = (unit, times) => unit.repeat(times);

describe('utf8Bytes', () => {
  it('counts one byte per ASCII character', () => {
    expect(utf8Bytes('abc')).toBe(3);
  });

  it('counts three bytes per Chinese character', () => {
    expect(utf8Bytes('浅草寺')).toBe(9);
  });

  it('counts four bytes for an astral-plane emoji', () => {
    expect(utf8Bytes('🗼')).toBe(4);
  });

  it('treats a missing value as empty', () => {
    expect(utf8Bytes(undefined)).toBe(0);
    expect(utf8Bytes(null)).toBe(0);
  });
});

describe('checkPassword', () => {
  it('leaves an empty value to the required rule', () => {
    expect(checkPassword('')).toBeNull();
    expect(checkPassword(undefined)).toBeNull();
  });

  it('rejects fewer characters than the floor', () => {
    expect(checkPassword(repeat('a', PASSWORD_MIN_CHARS - 1))).toBe('error.passwordRules');
  });

  it('accepts exactly the floor', () => {
    expect(checkPassword(repeat('a', PASSWORD_MIN_CHARS))).toBeNull();
  });

  it('measures the floor in characters, not bytes', () => {
    // 12 Chinese characters are 36 UTF-8 bytes. Counting bytes here would wrongly accept 4 of them.
    expect(checkPassword(repeat('密', PASSWORD_MIN_CHARS - 1))).toBe('error.passwordRules');
    expect(checkPassword(repeat('密', PASSWORD_MIN_CHARS))).toBeNull();
  });

  it('accepts exactly the byte ceiling', () => {
    expect(checkPassword(repeat('a', PASSWORD_MAX_BYTES))).toBeNull();
  });

  it('rejects one byte past the ceiling', () => {
    expect(checkPassword(repeat('a', PASSWORD_MAX_BYTES + 1))).toBe('error.passwordRules');
  });

  it('measures the ceiling in bytes, not characters', () => {
    // 25 Chinese characters are 75 bytes: well under a 72-character limit, over a 72-byte one.
    // This is the case the server's own @Size(max = 72) annotation misses.
    const passphrase = repeat('密', 25);
    expect(passphrase.length).toBeLessThan(PASSWORD_MAX_BYTES);
    expect(utf8Bytes(passphrase)).toBeGreaterThan(PASSWORD_MAX_BYTES);
    expect(checkPassword(passphrase)).toBe('error.passwordRules');
  });
});

describe('checkUsername', () => {
  it('leaves an empty value to the required rule', () => {
    expect(checkUsername('')).toBeNull();
  });

  it('accepts every character class the server allows', () => {
    expect(checkUsername('Traveller_1.a-b')).toBeNull();
  });

  it('rejects characters outside that set', () => {
    expect(checkUsername('trav eller')).toBe('error.usernameRules');
    expect(checkUsername('traveller!')).toBe('error.usernameRules');
    expect(checkUsername('旅行者')).toBe('error.usernameRules');
  });

  it('rejects a trailing newline that an unanchored pattern would let through', () => {
    expect(checkUsername('traveller\n')).toBe('error.usernameRules');
  });

  it('enforces both ends of the length range', () => {
    expect(checkUsername(repeat('a', USERNAME_MIN - 1))).toBe('error.usernameRules');
    expect(checkUsername(repeat('a', USERNAME_MIN))).toBeNull();
    expect(checkUsername(repeat('a', USERNAME_MAX))).toBeNull();
    expect(checkUsername(repeat('a', USERNAME_MAX + 1))).toBe('error.usernameRules');
  });
});

describe('checkDisplayName', () => {
  it('accepts an empty value — the server treats it as optional', () => {
    expect(checkDisplayName('')).toBeNull();
    expect(checkDisplayName(undefined)).toBeNull();
  });

  it('enforces the ceiling in characters, matching @Size(max = 100)', () => {
    expect(checkDisplayName(repeat('名', DISPLAY_NAME_MAX))).toBeNull();
    expect(checkDisplayName(repeat('a', DISPLAY_NAME_MAX + 1))).toBe('error.displayNameRules');
  });
});
