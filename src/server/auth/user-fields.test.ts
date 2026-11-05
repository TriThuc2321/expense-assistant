import { parseUserInput } from 'better-auth/db';
import { describe, expect, it } from 'vitest';

import { USER_ADDITIONAL_FIELDS } from './user-fields';

const options = { user: { additionalFields: USER_ADDITIONAL_FIELDS } };

describe('USER_ADDITIONAL_FIELDS', () => {
  it('rejects a client setting role', () => {
    expect(() => parseUserInput(options, { role: 'admin' }, 'update')).toThrow(
      /role is not allowed/,
    );
  });

  it('rejects a client setting blockedAt', () => {
    expect(() =>
      parseUserInput(options, { blockedAt: new Date() }, 'update'),
    ).toThrow(/blockedAt is not allowed/);
  });

  it('forces the default role on create, whatever is sent', () => {
    expect(parseUserInput(options, { role: 'admin' }, 'create').role).toBe(
      'user',
    );
  });
});
