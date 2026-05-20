import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto relative">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 pt-4 px-4">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
