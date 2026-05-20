'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, BarChart2, Upload, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Spending' },
  { href: '/upload', icon: Upload, label: 'Upload' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
      <div className="glass border-t bottom-nav">
        <div className="flex items-center justify-around px-2 pt-2">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            const isUpload = href === '/upload'
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 touch-active',
                  isActive
                    ? 'text-violet-400'
                    : 'text-muted-foreground hover:text-foreground',
                  isUpload && 'relative'
                )}
              >
                {isUpload ? (
                  <div className={cn(
                    'p-2.5 rounded-2xl transition-all duration-200',
                    isActive ? 'bg-violet-500' : 'bg-violet-500/20 hover:bg-violet-500/30'
                  )}>
                    <Icon size={20} className={isActive ? 'text-white' : 'text-violet-400'} />
                  </div>
                ) : (
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className="transition-all duration-200"
                  />
                )}
                <span className={cn(
                  'text-[10px] font-medium tracking-wide',
                  isUpload && 'mt-0.5'
                )}>
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
