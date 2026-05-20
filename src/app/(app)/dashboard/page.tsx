import { Suspense } from 'react'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { getCurrentMonth } from '@/lib/utils'

export default function DashboardPage() {
  const month = getCurrentMonth()
  return (
    <div className="space-y-4 page-transition">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient month={month} />
      </Suspense>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 rounded-2xl shimmer" />
      ))}
    </div>
  )
}
