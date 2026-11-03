import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { isPublicPath, proxy } from './proxy';

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

const SESSION_COOKIE = 'better-auth.session_token=x';

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

describe('proxy', () => {
  it('redirects a protected path without a session cookie to /login', () => {
    const res = proxy(request('/transactions'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets a protected path through with a session cookie', () => {
    const res = proxy(request('/transactions', SESSION_COOKIE));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it.each([undefined, SESSION_COOKIE])(
    'never redirects /login (cookie: %s)',
    (cookie) => {
      const res = proxy(request('/login', cookie));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    },
  );
});
