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

// Cookie presence only (no DB lookup): pages still enforce the real session
// via requireSession(). Signed-in users are not bounced off /login here,
// because a stale cookie would then loop between /login and /.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
