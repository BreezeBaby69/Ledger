'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Budget, Category } from '@/lib/types'
import { formatCurrency, getSpendingPercent, getCurrentMonth } from '@/lib/utils'
import { Plus, Edit2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO, subMonths, addMonths } from 'date-fns'

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [month, setMonth] = useState(getCurrentMonth())
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newCatId, setNewCatId] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [month])

  async function loadData() {
    setLoading(true)
    const start = month + '-01'
    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]

    const [{ data: cats }, { data: bdgs }, { data: txns }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('budgets').select('*, category:categories(*)').eq('month', month),
      supabase.from('transactions').select('category_id, amount').gte('date', start).lte('date', end).eq('is_transfer', false).lt('amount', 0),
    ])

    setCategories(cats || [])

    const spentMap: Record<string, number> = {}
    for (const t of txns || []) {
      if (t.category_id) spentMap[t.category_id] = (spentMap[t.category_id] || 0) + Math.abs(t.amount)
    }

    setBudgets((bdgs || []).map(b => ({ ...b, spent: spentMap[b.category_id] || 0 })))
    setLoading(false)
  }

  async function addBudget() {
    if (!newCatId || !newAmount) return
    const { error } = await supabase.from('budgets').insert({
      category_id: newCatId,
      amount: parseFloat(newAmount),
      month,
    })
    if (!error) {
      setAdding(false); setNewCatId(''); setNewAmount(''); loadData()
    }
  }

  async function updateBudget(id: string) {
    await supabase.from('budgets').update({ amount: parseFloat(editAmount) }).eq('id', id)
    setEditing(null); loadData()
  }

  async function deleteBudget(id: string) {
    if (!confirm('Remove this budget?')) return
    await supabase.from('budgets').delete().eq('id', id)
    loadData()
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const monthLabel = format(parseISO(month + '-01'), 'MMMM yyyy')
  const usedCategories = new Set(budgets.map(b => b.category_id))
  const availableCategories = categories.filter(c => !usedCategories.has(c.id))

  return (
    <div className="space-y-5 page-transition">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(format(subMonths(parseISO(month + '-01'), 1), 'yyyy-MM'))}
          className="p-2 rounded-xl hover:bg-muted"
        >←</button>
        <span className="font-medium text-sm">{monthLabel}</span>
        <button
          onClick={() => { const n = addMonths(parseISO(month + '-01'), 1); if (n <= new Date()) setMonth(format(n, 'yyyy-MM')) }}
          className="p-2 rounded-xl hover:bg-muted disabled:opacity-30"
          disabled={month === getCurrentMonth()}
        >→</button>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-2xl border p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">of {formatCurrency(totalBudget)}</p>
            <p className={cn('text-sm font-medium', totalSpent > totalBudget ? 'text-rose-400' : 'text-emerald-400')}>
              {totalSpent > totalBudget ? '−' : '+'}{formatCurrency(Math.abs(totalBudget - totalSpent))} {totalSpent > totalBudget ? 'over' : 'left'}
            </p>
          </div>
        </div>
        {/* Overall bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', totalSpent > totalBudget ? 'bg-rose-500' : 'bg-violet-500')}
            style={{ width: `${Math.min(getSpendingPercent(totalSpent, totalBudget), 100)}%` }}
          />
        </div>
      </div>

      {/* Budget list */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl shimmer" />)}</div>
      ) : (
        <div className="space-y-2">
          {budgets
            .sort((a, b) => b.spent - a.spent)
            .map(budget => {
              const pct = getSpendingPercent(budget.spent, budget.amount)
              const isOver = pct > 100
              const color = budget.category?.color || '#8b5cf6'

              return (
                <div key={budget.id} className="bg-card rounded-2xl border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{budget.category?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{budget.category?.name}</p>
                    </div>
                    {editing === budget.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                          autoFocus
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="w-20 bg-muted rounded-lg px-2 py-1 text-sm text-right"
                        />
                        <button onClick={() => updateBudget(budget.id)} className="p-1 text-emerald-400"><Check size={14} /></button>
                        <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium tabular-nums', isOver ? 'text-rose-400' : '')}>
                          {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                        </span>
                        <button
                          onClick={() => { setEditing(budget.id); setEditAmount(budget.amount.toString()) }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isOver ? '#f43f5e' : color }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={cn('text-xs', isOver ? 'text-rose-400' : 'text-muted-foreground')}>
                      {isOver ? `${formatCurrency(budget.spent - budget.amount)} over` : `${formatCurrency(budget.amount - budget.spent)} left`}
                    </span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              )
            })}

          {/* Add budget form */}
          {adding ? (
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <select
                value={newCatId}
                onChange={e => setNewCatId(e.target.value)}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="">Select category...</option>
                {availableCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    placeholder="Monthly amount"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="w-full bg-muted/50 border rounded-xl pl-6 pr-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <button onClick={addBudget} className="px-4 bg-violet-500 text-white rounded-xl text-sm font-medium">Add</button>
                <button onClick={() => setAdding(false)} className="px-4 bg-muted text-muted-foreground rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-violet-500/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Add Budget Category</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
