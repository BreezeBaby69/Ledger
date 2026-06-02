'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MonthlyStats, Budget, Account, Transaction } from '@/lib/types'
import { formatCurrency, getCurrentMonth } from '@/lib/utils'
import SpendingRing from './SpendingRing'
import BudgetCard from './BudgetCard'
import RecentTransactions from './RecentTransactions'
import AccountCards from './AccountCards'
import MonthlyTrendChart from './MonthlyTrendChart'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { format, parseISO, subMonths, addMonths } from 'date-fns'

export default function DashboardClient({ month: initialMonth }: { month: string }) {
  const [month, setMonth] = useState(initialMonth)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [month])

  async function loadData() {
    setLoading(true)
    try {
      const { data: accs } = await supabase.from('accounts').select('*').order('created_at')
      setAccounts(accs || [])

      const start = month + '-01'
      const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

      const { data: txns } = await supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false })

      const allTxns = txns || []
      const expenses = allTxns.filter((t: any) => t.amount < 0 && !t.is_transfer)
      const income = allTxns.filter((t: any) => t.amount > 0 && !t.is_transfer)

      const byCategory: Record<string, MonthlyStats['by_category'][0]> = {}
      for (const t of expenses) {
        const catId = t.category_id || 'uncategorized'
        if (!byCategory[catId]) {
          byCategory[catId] = {
            category_id: catId,
            category_name: (t.category as any)?.name || 'Uncategorized',
            category_color: (t.category as any)?.color || '#00f5ff',
            amount: 0,
            transaction_count: 0,
          }
        }
        byCategory[catId].amount += Math.abs(t.amount)
        byCategory[catId].transaction_count++
      }

      const totalIncome = income.reduce((s: number, t: any) => s + t.amount, 0)
      const totalSpent = expenses.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

      setStats({
        month,
        total_spent: totalSpent,
        total_income: totalIncome,
        net: totalIncome - totalSpent,
        by_category: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
      })

      setRecentTxns(allTxns.slice(0, 8))

      const { data: bdgs } = await supabase.from('budgets').select('*, category:categories(*)').eq('month', month)
      const spentByCategory: Record<string, number> = {}
      for (const t of expenses) {
        if (t.category_id) spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Math.abs(t.amount)
      }
      setBudgets((bdgs || []).map((b: any) => ({ ...b, spent: spentByCategory[b.category_id] || 0 })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() { setMonth(format(subMonths(parseISO(month + '-01'), 1), 'yyyy-MM')) }
  function nextMonth() {
    const next = addMonths(parseISO(month + '-01'), 1)
    if (next <= new Date()) setMonth(format(next, 'yyyy-MM'))
  }

  const isCurrentMonth = month === getCurrentMonth()
  const monthLabel = format(parseISO(month + '-01'), 'MMM yyyy').toUpperCase()
  const monthNet = (stats?.total_income || 0) - (stats?.total_spent || 0)

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-4 page-transition">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 touch-active" style={{ color: 'var(--cyan)' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--cyan)' }}>
          {monthLabel}
        </span>
        <button onClick={nextMonth} disabled={isCurrentMonth} className="p-2 touch-active" style={{ color: isCurrentMonth ? 'var(--text-muted)' : 'var(--cyan)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Hero HUD card */}
      <div className="opt-card p-5" style={{ background: 'linear-gradient(135deg, #061a26, #030f18)' }}>
        <p className="opt-label mb-3">// MONTHLY NET</p>
        <p className="stat-number text-4xl font-bold mb-4" style={{
          color: monthNet >= 0 ? 'var(--green)' : 'var(--red)',
          textShadow: monthNet >= 0 ? '0 0 20px rgba(0,255,136,0.4)' : '0 0 20px rgba(255,59,92,0.4)',
        }}>
          {monthNet >= 0 ? '+' : ''}{formatCurrency(monthNet)}
        </p>
        <div className="flex gap-8">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} style={{ color: 'var(--green)' }} />
              <span className="opt-label" style={{ color: 'var(--green)' }}>INCOME</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--green)', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>
              {formatCurrency(stats?.total_income || 0)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={11} style={{ color: 'var(--orange)' }} />
              <span className="opt-label" style={{ color: 'var(--orange)' }}>SPENT</span>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--orange)', textShadow: '0 0 10px rgba(255,107,0,0.3)' }}>
              {formatCurrency(stats?.total_spent || 0)}
            </p>
          </div>
        </div>
        {/* Corner decoration */}
        <div style={{ position: 'absolute', top: '8px', right: '12px', fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
          SYS::ACTIVE
        </div>
      </div>

      {/* Spending ring */}
      {stats && stats.total_spent > 0 && <SpendingRing stats={stats} budgets={budgets} />}

      {/* Accounts */}
      <AccountCards accounts={accounts} />

      {/* Budgets */}
      {budgets.length > 0 && (
        <div>
          <p className="opt-label mb-3">// BUDGET STATUS</p>
          <div className="space-y-2">
            {budgets.slice(0, 5).map(b => <BudgetCard key={b.id} budget={b} />)}
          </div>
        </div>
      )}

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="opt-label">// RECENT ACTIVITY</p>
          <a href="/transactions" style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--cyan)' }}>VIEW ALL →</a>
        </div>
        <RecentTransactions transactions={recentTxns} />
      </div>

      {/* Trend */}
      <div>
        <p className="opt-label mb-3">// 6-MONTH TREND</p>
        <MonthlyTrendChart currentMonth={month} />
      </div>

      <div className="h-2" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => <div key={i} className="shimmer rounded" style={{ height: i === 1 ? '120px' : '80px' }} />)}
    </div>
  )
}
