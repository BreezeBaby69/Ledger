'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, BarChart2, Upload, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'HOME' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'DATA' },
  { href: '/upload', icon: Upload, label: 'IMPORT' },
  { href: '/analytics', icon: BarChart2, label: 'INTEL' },
  { href: '/settings', icon: Settings, label: 'SYS' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
      <div className="glass border-t bottom-nav">
        <div className="flex items-center justify-around px-1 pt-2">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            const isUpload = href === '/upload'

            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 px-2 py-2 touch-active transition-all"
                style={{
                  color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
                  borderTop: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
                  marginTop: '-2px',
                }}
              >
                {isUpload ? (
                  <div style={{
                    padding: '8px',
                    border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border-cyan)'}`,
                    background: isActive ? 'rgba(0,245,255,0.12)' : 'transparent',
                    borderRadius: '4px',
                    boxShadow: isActive ? '0 0 12px rgba(0,245,255,0.3)' : 'none',
                  }}>
                    <Icon size={18} style={{ color: isActive ? 'var(--cyan)' : 'var(--text-muted)' }} />
                  </div>
                ) : (
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                )}
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '8px',
                  letterSpacing: '0.15em',
                  textShadow: isActive ? '0 0 8px var(--cyan-glow)' : 'none',
                }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
