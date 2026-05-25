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
import { cn } from '@/lib/utils'

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
      const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
        .toISOString().split('T')[0]

      const { data: txns } = await supabase
        .from('transactions')
        .select('*, category:categories(*), account:accounts(*)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })

      const allTxns = txns || []

      // Expenses = negative amounts that are NOT transfers
      const expenses = allTxns.filter((t: any) => t.amount < 0 && !t.is_transfer)

      // Income = positive amounts that are NOT transfers
      const income = allTxns.filter((t: any) => t.amount > 0 && !t.is_transfer)

      // Build category breakdown from expenses
      const byCategory: Record<string, MonthlyStats['by_category'][0]> = {}
      for (const t of expenses) {
        const catId = t.category_id || 'uncategorized'
        if (!byCategory[catId]) {
          byCategory[catId] = {
            category_id: catId,
            category_name: (t.category as any)?.name || 'Uncategorized',
            category_color: (t.category as any)?.color || '#94a3b8',
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

      // Load budgets with spent amounts
      const { data: bdgs } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('month', month)

      const spentByCategory: Record<string, number> = {}
      for (const t of expenses) {
        if (t.category_id) {
          spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + Math.abs(t.amount)
        }
      }

      setBudgets((bdgs || []).map((b: any) => ({ ...b, spent: spentByCategory[b.category_id] || 0 })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    const date = parseISO(month + '-01')
    setMonth(format(subMonths(date, 1), 'yyyy-MM'))
  }

  function nextMonth() {
    const date = parseISO(month + '-01')
    const next = addMonths(date, 1)
    if (next <= new Date()) setMonth(format(next, 'yyyy-MM'))
  }

  const isCurrentMonth = month === getCurrentMonth()
  const monthLabel = format(parseISO(month + '-01'), 'MMMM yyyy')

  // Net worth = sum of all account balances (credit cards subtract)
  const totalBalance = accounts.reduce((s, a) => {
    return a.type === 'credit_card' ? s - a.balance : s + a.balance
  }, 0)

  // Net for the month = income - expenses
  const monthNet = (stats?.total_income || 0) - (stats?.total_spent || 0)

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-5">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft size={18} className="text-muted-foreground" />
        </button>
        <span className="font-medium text-sm">{monthLabel}</span>
        <button onClick={nextMonth} disabled={isCurrentMonth}
          className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30">
          <ChevronRight size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Hero Card */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #1e0a4a 0%, #2d1065 50%, #1a1040 100%)'
      }}>
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #8b5cf6 0%, transparent 60%)' }} />
        <div className="relative">
          <p className="text-violet-300 text-xs font-medium uppercase tracking-wider mb-1">
            {isCurrentMonth ? 'This Month' : monthLabel}
          </p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-white">
                {monthNet >= 0 ? '+' : ''}{formatCurrency(monthNet)}
              </p>
              <p className="text-violet-300 text-xs mt-0.5">
                {monthNet >= 0 ? 'ahead this month' : 'over income this month'}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="flex items-center gap-1 text-emerald-400 mb-0.5">
                <TrendingUp size={12} />
                <span className="text-xs">Income</span>
              </div>
              <p className="text-sm font-medium text-white tabular-nums">
                {formatCurrency(stats?.total_income || 0)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-rose-400 mb-0.5">
                <TrendingDown size={12} />
                <span className="text-xs">Spent</span>
              </div>
              <p className="text-sm font-medium text-white tabular-nums">
                {formatCurrency(stats?.total_spent || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spending Ring */}
      {stats && stats.total_spent > 0 && (
        <SpendingRing stats={stats} budgets={budgets} />
      )}

      {/* Account Cards */}
      <AccountCards accounts={accounts} />

      {/* Budget Progress */}
      {budgets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Budget Progress
          </h2>
          <div className="space-y-2">
            {budgets.slice(0, 5).map(b => (
              <BudgetCard key={b.id} budget={b} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent</h2>
          <a href="/transactions" className="text-xs text-violet-400 font-medium">See all</a>
        </div>
        <RecentTransactions transactions={recentTxns} />
      </div>

      {/* Monthly Trend */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          6-Month Trend
        </h2>
        <MonthlyTrendChart currentMonth={month} />
      </div>

      <div className="h-2" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 mx-auto rounded-lg shimmer" />
      <div className="h-36 rounded-2xl shimmer" />
      <div className="h-48 rounded-2xl shimmer" />
      <div className="h-24 rounded-2xl shimmer" />
      <div className="h-64 rounded-2xl shimmer" />
    </div>
  )
}
