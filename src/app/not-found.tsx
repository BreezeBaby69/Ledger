import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
      <p className="text-6xl">🤔</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-sm">That page doesn't exist.</p>
      <Link href="/dashboard" className="mt-2 bg-violet-500 text-white rounded-2xl px-6 py-3 text-sm font-semibold">
        Go to Dashboard
      </Link>
    </div>
  )
}
