import { describe, expect, it } from 'vitest';

import { classifySession } from './session';

const allowed = new Set(['ok@x.com']);
const withEmail = (email: string) => ({
  user: { email },
  session: { id: 's1' },
});

describe('classifySession', () => {
  it('returns ok for an allowlisted email', () => {
    const s = withEmail('OK@x.com');
    expect(classifySession(s, allowed)).toEqual({ status: 'ok', session: s });
  });

  it('returns not_invited for an email removed from the list', () => {
    const s = withEmail('removed@x.com');
    expect(classifySession(s, allowed)).toEqual({
      status: 'not_invited',
      session: s,
    });
  });

  it('returns none without a session', () => {
    expect(classifySession(null, allowed)).toEqual({ status: 'none' });
  });
});
