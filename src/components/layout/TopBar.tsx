'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { format } from 'date-fns'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'OVERVIEW',
  '/transactions': 'TRANSACTIONS',
  '/upload': 'IMPORT',
  '/budgets': 'BUDGETS',
  '/accounts': 'ACCOUNTS',
  '/analytics': 'ANALYTICS',
  '/settings': 'SETTINGS',
}

export default function TopBar() {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname.startsWith(p))?.[1] || 'OPTIMIZE'
  const today = format(new Date(), 'EEE dd MMM yyyy').toUpperCase()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-40 safe-top">
      <div className="glass border-b px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'var(--cyan)',
              textShadow: '0 0 14px var(--cyan-glow)',
            }}>
              {title}
            </h1>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
              marginTop: '1px',
            }}>
              {today}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
