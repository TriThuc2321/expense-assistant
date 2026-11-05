import { describe, expect, it } from 'vitest';

import { classifySession } from './session';

describe('classifySession', () => {
  it('returns ok for an unblocked user', () => {
    expect(classifySession({ user: { blockedAt: null } })).toEqual({
      status: 'ok',
      session: expect.anything(),
    });
  });

  it('returns blocked for a blocked user', () => {
    expect(classifySession({ user: { blockedAt: new Date() } })).toMatchObject({
      status: 'blocked',
    });
  });

  it('treats a missing blockedAt as ok', () => {
    expect(classifySession({ user: {} })).toMatchObject({ status: 'ok' });
  });

  it('returns none without a session', () => {
    expect(classifySession(null)).toEqual({ status: 'none' });
  });
});
