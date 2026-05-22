'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { format } from 'date-fns'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/transactions': 'Transactions',
  '/upload': 'Import',
  '/budgets': 'Budgets',
  '/accounts': 'Accounts',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
}

export default function TopBar() {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname.startsWith(p))?.[1] || 'Ledger'
  const today = format(new Date(), 'EEEE, MMMM d')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-40 safe-top">
      <div className="glass border-b px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  )
}
