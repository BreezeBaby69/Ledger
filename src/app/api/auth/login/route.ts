import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const correctPassword = process.env.APP_PASSWORD

  if (!correctPassword) {
    return NextResponse.json({ error: 'APP_PASSWORD not configured' }, { status: 500 })
  }

  if (password !== correctPassword) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const res = NextResponse.json({ success: true })

  // Set auth cookie — expires in 30 days
  res.cookies.set('ledger_auth', process.env.APP_PASSWORD!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return res
}
