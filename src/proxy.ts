import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const LOGIN_PATH = '/login';
const PUBLIC_PREFIXES = ['/api/auth/', '/api/zalo/'];

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

// Cookie presence only (no DB lookup): pages still enforce the real session via requireSession().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = getSessionCookie(request) !== null;

  if (pathname === LOGIN_PATH && hasSessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (isPublicPath(pathname) || hasSessionCookie) return NextResponse.next();

  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
