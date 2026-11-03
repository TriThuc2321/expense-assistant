import { describe, expect, it } from 'vitest';

import { isEmailAllowed, parseAllowedEmails } from './allowlist';

describe('parseAllowedEmails', () => {
  it('trims, lowercases and drops empties', () => {
    expect(parseAllowedEmails(' Thuc@Gmail.com , b@x.com,, ')).toEqual(
      new Set(['thuc@gmail.com', 'b@x.com']),
    );
  });
});

describe('isEmailAllowed', () => {
  const allowed = parseAllowedEmails('thuc@gmail.com');
  it('matches case-insensitively', () =>
    expect(isEmailAllowed('THUC@gmail.com ', allowed)).toBe(true));
  it('rejects others', () =>
    expect(isEmailAllowed('x@gmail.com', allowed)).toBe(false));
  it('rejects empty/null', () => {
    expect(isEmailAllowed('', parseAllowedEmails(','))).toBe(false);
    expect(isEmailAllowed(null, allowed)).toBe(false);
  });
});
