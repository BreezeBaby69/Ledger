'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError('// ACCESS DENIED')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            width: '64px', height: '64px',
            border: '1px solid var(--cyan)',
            borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 20px rgba(0,245,255,0.2), inset 0 0 20px rgba(0,245,255,0.05)',
            background: 'rgba(0,245,255,0.05)',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 900, color: 'var(--cyan)', textShadow: '0 0 14px var(--cyan-glow)' }}>◈</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 900, letterSpacing: '0.3em', color: 'var(--cyan)', textShadow: '0 0 20px var(--cyan-glow)', marginBottom: '6px' }}>
            OPTIMIZE
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.25em', color: 'var(--text-muted)' }}>
            PERSONAL FINANCE SYSTEM v1.0
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p className="opt-label" style={{ marginBottom: '8px' }}>// AUTHENTICATION KEY</p>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="ENTER ACCESS CODE"
                autoComplete="current-password"
                className="opt-input"
                style={{ paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em', color: 'var(--red)', textShadow: '0 0 8px rgba(255,59,92,0.5)', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={!password || loading} className="opt-btn-primary"
            style={{ padding: '14px', fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.25em', borderRadius: '4px', border: '1px solid var(--cyan)' }}>
            {loading ? 'AUTHENTICATING...' : '[ INITIALIZE ]'}
          </button>
        </form>

        <p style={{ fontFamily: 'var(--font-display)', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-muted)', textAlign: 'center', marginTop: '32px' }}>
          SECURE CHANNEL · ENCRYPTED
        </p>
      </div>
    </div>
  )
}
