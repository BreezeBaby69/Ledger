'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body className="dark">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <p className="text-6xl">⚠️</p>
          <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
          <p className="text-gray-400 text-sm">{error.message}</p>
          <button
            onClick={reset}
            className="mt-2 bg-violet-500 text-white rounded-2xl px-6 py-3 text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
