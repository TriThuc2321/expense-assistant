import { describe, expect, it } from 'vitest';

import { isPublicPath } from './proxy';

describe('isPublicPath', () => {
  it.each(['/login', '/api/auth/callback/google', '/api/zalo/webhook'])(
    '%s is public',
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(['/', '/transactions', '/settings', '/loginx', '/api/authx'])(
    '%s is protected',
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});
