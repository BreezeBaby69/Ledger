import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — always accessible
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const auth = request.cookies.get('ledger_auth')
  const correctPassword = process.env.APP_PASSWORD

  if (!auth || auth.value !== correctPassword) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect root to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
