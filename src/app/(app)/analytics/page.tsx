'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getCurrentMonth, getPreviousMonths, formatDate } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts'
import { format, parseISO, subMonths, addMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ArrowLeft, X, Check } from 'lucide-react'

interface CategoryData {
  category_id: string
  name: string
  color: string
  icon: string
  amount: number
  transaction_count: number
}

interface DrillTxn {
  id: string
  date: string
  merchant: string
  amount: number
  category_id: string | null
  category: { name: string; color: string; icon: string } | null
}

interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export default function AnalyticsPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [recurringData, setRecurringData] = useState<any[]>([])
  const [dismissedMerchants, setDismissedMerchants] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'spending' | 'trends' | 'recurring'>('spending')

  const [drillCategory, setDrillCategory] = useState<CategoryData | null>(null)
  const [drillTxns, setDrillTxns] = useState<DrillTxn[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    setLoading(true)
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const { data: cats } = await supabase.from('categories').select('id, name, color, icon').order('name')
    setAllCategories(cats || [])

    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, category_id, category:categories(id, name, color, icon)')
      .gte('date', start).lte('date', end)
      .eq('is_transfer', false).lt('amount', 0)

    const catMap: Record<string, CategoryData> = {}
    for (const t of txns || []) {
      const cat = t.category as any
      const id = t.category_id || 'uncategorized'
      if (!catMap[id]) catMap[id] = {
        category_id: id,
        name: cat?.name || 'Uncategorized',
        color: cat?.color || '#00f5ff',
        icon: cat?.icon || '◈',
        amount: 0,
        transaction_count: 0,
      }
      catMap[id].amount += Math.abs(t.amount)
      catMap[id].transaction_count++
    }
    setCategoryData(Object.values(catMap).sort((a, b) => b.amount - a.amount))

    const months = getPreviousMonths(6)
    const trend = await Promise.all(months.map(async m => {
      const s = m + '-01'
      const e = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]), 0).toISOString().split('T')[0]
      const { data } = await supabase.from('transactions').select('amount, is_transfer').gte('date', s).lte('date', e)
      const all = data || []
      return {
        month: m,
        label: format(parseISO(m + '-01'), 'MMM').toUpperCase(),
        spent: all.filter((t: any) => t.amount < 0 && !t.is_transfer).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
        income: all.filter((t: any) => t.amount > 0 && !t.is_transfer).reduce((s: number, t: any) => s + t.amount, 0),
      }
    }))
    setTrendData(trend)

    const { data: dismissed } = await supabase.from('dismissed_recurring').select('merchant')
    const dismissedSet = new Set((dismissed || []).map((d: any) => d.merchant))
    setDismissedMerchants(dismissedSet)

    const { data: recTxns } = await supabase
      .from('transactions')
      .select('merchant, amount, category:categories(name, color, icon)')
      .eq('is_recurring', true)
      .eq('is_transfer', false)
      .lt('amount', 0)

    const recMap: Record<string, any> = {}
    for (const t of recTxns || []) {
      if (dismissedSet.has(t.merchant)) continue
      const key = t.merchant
      if (!recMap[key]) recMap[key] = { merchant: t.merchant, amount: Math.abs(t.amount), category: t.category, count: 1 }
      else { recMap[key].count++; recMap[key].amount = Math.abs(t.amount) }
    }
    setRecurringData(Object.values(recMap).sort((a, b) => b.amount - a.amount))

    // If drill-down open, refresh it too
    if (drillCategory) {
      await loadDrillTxns(drillCategory)
    }

    setLoading(false)
  }

  async function dismissRecurring(merchant: string) {
    await supabase.from('dismissed_recurring').insert({ merchant })
    setDismissedMerchants(prev => new Set([...prev, merchant]))
    setRecurringData(prev => prev.filter(r => r.merchant !== merchant))
  }

  async function loadDrillTxns(cat: CategoryData) {
    setDrillLoading(true)
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    let query = supabase
      .from('transactions')
      .select('id, date, merchant, amount, category_id, category:categories(name, color, icon)')
      .gte('date', start).lte('date', end)
      .eq('is_transfer', false).lt('amount', 0)
      .order('date', { ascending: false })

    if (cat.category_id === 'uncategorized') {
      query = query.is('category_id', null)
    } else {
      query = query.eq('category_id', cat.category_id)
    }

    const { data } = await query
    setDrillTxns((data || []) as any[])
    setDrillLoading(false)
  }

  async function openDrillDown(cat: CategoryData) {
    setDrillCategory(cat)
    await loadDrillTxns(cat)
  }

  function closeDrillDown() {
    setDrillCategory(null)
    setDrillTxns([])
  }

  async function updateTxnCategory(txnId: string, newCategoryId: string) {
    setSavingId(txnId)
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: newCategoryId || null })
      .eq('id', txnId)

    if (!error) {
      setSavedId(txnId)
      setTimeout(() => setSavedId(null), 1200)
      // Remove from current drill list since it no longer belongs to this category
      setDrillTxns(prev => prev.filter(t => t.id !== txnId))
      // Refresh category totals in background
      loadData()
    }
    setSavingId(null)
  }

  function prevMonth() {
    setMonth(format(subMonths(parseISO(month + '-01'), 1), 'yyyy-MM'))
    closeDrillDown()
  }

  function nextMonth() {
    const next = addMonths(parseISO(month + '-01'), 1)
    if (next <= new Date()) { setMonth(format(next, 'yyyy-MM')); closeDrillDown() }
  }

  const totalSpent = categoryData.reduce((s, c) => s + c.amount, 0)
  const monthLabel = format(parseISO(month + '-01'), 'MMM yyyy').toUpperCase()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', padding: '8px 12px', borderRadius: '2px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--cyan)', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--orange)' }}>SPENT: {formatCurrency(payload[0]?.value || 0)}</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--green)' }}>INCOME: {formatCurrency(payload[1]?.value || 0)}</p>
      </div>
    )
  }

  // ---- Drill-down view ----
  if (drillCategory) {
    return (
      <div className="space-y-4 page-transition">
        <div className="flex items-center gap-3">
          <button onClick={closeDrillDown} className="p-2 touch-active" style={{ color: 'var(--cyan)' }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{drillCategory.icon}</span>
            <div className="min-w-0">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '0.15em', color: 'var(--cyan)', textShadow: '0 0 10px var(--cyan-glow)' }} className="truncate">
                {drillCategory.name.toUpperCase()}
              </h2>
              <p className="opt-label" style={{ marginTop: '2px' }}>{monthLabel}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--orange)', textShadow: '0 0 8px rgba(255,107,0,0.3)' }}>{formatCurrency(drillCategory.amount)}</p>
            <p className="opt-label" style={{ marginTop: '2px' }}>{drillTxns.length} TXN</p>
          </div>
        </div>

        <div className="opt-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="opt-label">% OF TOTAL SPENDING</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--cyan)' }}>{Math.round(drillCategory.amount / totalSpent * 100)}%</span>
          </div>
          <div className="opt-progress-track">
            <div className="opt-progress-fill" style={{
              width: `${Math.round(drillCategory.amount / totalSpent * 100)}%`,
              background: drillCategory.color,
              boxShadow: `0 0 6px ${drillCategory.color}`,
            }} />
          </div>
        </div>

        <p className="opt-label">// TAP A CATEGORY TO RECLASSIFY</p>

        {drillLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="shimmer rounded" style={{ height: '64px' }} />)}</div>
        ) : drillTxns.length === 0 ? (
          <div className="opt-card p-8 text-center">
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>NO TRANSACTIONS</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drillTxns.map(txn => (
              <div key={txn.id} className="opt-card p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }} className="truncate">{txn.merchant}</p>
                    <p className="opt-label" style={{ marginTop: '2px' }}>{formatDate(txn.date, 'EEE MMM d').toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {savedId === txn.id && <Check size={14} style={{ color: 'var(--green)' }} />}
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--text-primary)' }}>
                      {formatCurrency(txn.amount)}
                    </span>
                  </div>
                </div>
                <select
                  value={txn.category_id || ''}
                  onChange={e => updateTxnCategory(txn.id, e.target.value)}
                  disabled={savingId === txn.id}
                  className="opt-input"
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  <option value="">UNCATEGORIZED</option>
                  {allCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="opt-card p-4 flex items-center justify-between">
          <span className="opt-label">TOTAL</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--orange)', textShadow: '0 0 8px rgba(255,107,0,0.3)' }}>
            {formatCurrency(drillCategory.amount)}
          </span>
        </div>
        <div className="h-2" />
      </div>
    )
  }

  // ---- Main view ----
  return (
    <div className="space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 touch-active" style={{ color: 'var(--cyan)' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--cyan)' }}>{monthLabel}</span>
        <button onClick={nextMonth} disabled={month === getCurrentMonth()} className="p-2 touch-active" style={{ color: month === getCurrentMonth() ? 'var(--text-muted)' : 'var(--cyan)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="opt-card flex" style={{ padding: '4px' }}>
        {(['spending', 'trends', 'recurring'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="flex-1 py-2 transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              letterSpacing: '0.15em',
              borderRadius: '2px',
              color: view === v ? 'var(--cyan)' : 'var(--text-muted)',
              background: view === v ? 'rgba(0,245,255,0.08)' : 'transparent',
              border: view === v ? '1px solid var(--border-cyan-active)' : '1px solid transparent',
            }}>
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer rounded" style={{ height: '96px' }} />)}</div>
      ) : (
        <>
          {view === 'spending' && (
            <div className="space-y-4">
              <div className="opt-card p-4">
                <p className="opt-label mb-4">// SPENDING BY CATEGORY</p>
                <div className="flex items-center gap-4">
                  <div style={{ width: 140, height: 140 }} className="flex-shrink-0">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="amount" stroke="none">
                          {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color})` }} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {categoryData.slice(0, 5).map(cat => (
                      <button key={cat.category_id} onClick={() => openDrillDown(cat)}
                        className="w-full flex items-center gap-2 hover:opacity-70 transition-opacity text-left touch-active">
                        <div className="w-2 h-2 flex-shrink-0" style={{ background: cat.color, boxShadow: `0 0 4px ${cat.color}` }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }} className="truncate flex-1">{cat.name}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-primary)', flexShrink: 0 }}>
                          {Math.round(cat.amount / totalSpent * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="opt-card overflow-hidden">
                <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-cyan)' }}>
                  <p className="opt-label">TAP A CATEGORY TO SEE TRANSACTIONS</p>
                </div>
                {categoryData.map(cat => (
                  <button key={cat.category_id} onClick={() => openDrillDown(cat)}
                    className="w-full px-4 py-3 text-left transition-colors touch-active opt-row"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,245,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{cat.icon}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-primary)', flex: 1 }}>{cat.name.toUpperCase()}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--orange)' }}>{formatCurrency(cat.amount)}</span>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="opt-progress-track flex-1">
                        <div className="opt-progress-fill" style={{ width: `${Math.round(cat.amount / totalSpent * 100)}%`, background: cat.color, boxShadow: `0 0 4px ${cat.color}` }} />
                      </div>
                      <span className="opt-label flex-shrink-0">{cat.transaction_count} TXN · {Math.round(cat.amount / totalSpent * 100)}%</span>
                    </div>
                  </button>
                ))}
                {categoryData.length === 0 && (
                  <div className="p-8 text-center">
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>NO SPENDING DATA</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'trends' && (
            <div className="space-y-4">
              <div className="opt-card p-4">
                <p className="opt-label mb-4">// 6-MONTH OVERVIEW</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,245,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,245,255,0.04)' }} />
                    <Bar dataKey="spent" name="Spent" fill="var(--orange)" radius={[2, 2, 0, 0]} opacity={0.9} />
                    <Bar dataKey="income" name="Income" fill="var(--green)" radius={[2, 2, 0, 0]} opacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-6 justify-center mt-2">
                  <div className="flex items-center gap-1.5"><div style={{ width: '8px', height: '8px', background: 'var(--orange)', boxShadow: '0 0 4px var(--orange)' }} /><span className="opt-label">SPENT</span></div>
                  <div className="flex items-center gap-1.5"><div style={{ width: '8px', height: '8px', background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }} /><span className="opt-label">INCOME</span></div>
                </div>
              </div>

              <div className="opt-card p-4">
                <p className="opt-label mb-4">// SPENDING TREND</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,245,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="spent" name="Spent" stroke="var(--cyan)" strokeWidth={2}
                      dot={{ fill: 'var(--cyan)', strokeWidth: 0, r: 3 }}
                      style={{ filter: 'drop-shadow(0 0 6px var(--cyan))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="opt-card overflow-hidden">
                {[...trendData].reverse().map(m => (
                  <div key={m.month} className="flex items-center justify-between px-4 py-3 opt-row">
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>{m.month}</span>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="opt-label">SPENT</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--orange)' }}>{formatCurrency(m.spent)}</p>
                      </div>
                      <div>
                        <p className="opt-label">INCOME</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--green)' }}>{formatCurrency(m.income)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'recurring' && (
            <div className="space-y-4">
              <div className="opt-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="opt-label">// RECURRING EXPENSES</p>
                    <p className="opt-label" style={{ marginTop: '4px', opacity: 0.7 }}>SAME MERCHANT · 3+ MONTHS · WITHIN $5</p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--orange)', textShadow: '0 0 8px rgba(255,107,0,0.3)' }}>
                    {formatCurrency(recurringData.reduce((s, r) => s + r.amount, 0))}/MO
                  </span>
                </div>
              </div>

              <div className="opt-card overflow-hidden">
                {recurringData.length === 0 ? (
                  <div className="p-8 text-center">
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>NO RECURRING DETECTED</p>
                  </div>
                ) : (
                  recurringData.map(r => (
                    <div key={r.merchant} className="flex items-center gap-3 px-4 py-3 opt-row">
                      <div className="w-9 h-9 flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid var(--border-cyan)', borderRadius: '2px' }}>
                        {r.category?.icon || '◈'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-primary)' }} className="truncate">{r.merchant}</p>
                        <p className="opt-label" style={{ marginTop: '2px' }}>{(r.category?.name || 'UNCATEGORIZED').toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--orange)' }}>{formatCurrency(r.amount)}</p>
                          <p className="opt-label">MONTHLY</p>
                        </div>
                        <button onClick={() => dismissRecurring(r.merchant)} className="p-1.5 touch-active" style={{ color: 'var(--text-muted)' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {dismissedMerchants.size > 0 && (
                <p className="opt-label text-center">{dismissedMerchants.size} MERCHANT{dismissedMerchants.size !== 1 ? 'S' : ''} HIDDEN</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
