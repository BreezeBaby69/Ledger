'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PendingTxn {
  id: string
  date: string
  merchant: string
  amount: number
  suggested_category_id?: string
  is_transfer_candidate: boolean
  is_duplicate_candidate: boolean
  status: 'pending' | 'approved' | 'rejected'
}

interface Props {
  transactions: PendingTxn[]
  accountId: string
  onImport: (approved: PendingTxn[]) => void
  onCancel: () => void
}

export default function ImportReview({ transactions, accountId, onImport, onCancel }: Props) {
  const [txns, setTxns] = useState<PendingTxn[]>(
    transactions.map(t => ({
      ...t,
      status: t.is_duplicate_candidate ? 'rejected' : 'approved',
    }))
  )
  const [categories, setCategories] = useState<Category[]>([])
  const [importing, setImporting] = useState(false)
  // Track which merchant+amount combos the user has manually categorized this session
  const [manualRules, setManualRules] = useState<Map<string, string>>(new Map())
  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      setCategories(data || [])
    })
  }, [])

  function toggleStatus(id: string) {
    setTxns(prev => prev.map(t => t.id === id ? {
      ...t,
      status: t.status === 'approved' ? 'rejected' : 'approved',
    } : t))
  }

  function setCategory(id: string, catId: string, merchant: string, amount: number) {
    // Update this transaction
    setTxns(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, suggested_category_id: catId }
      }
      // Auto-apply to other transactions with exact same merchant + amount
      if (t.merchant === merchant && t.amount === amount && t.id !== id) {
        return { ...t, suggested_category_id: catId }
      }
      return t
    }))

    // Remember this rule for the session
    const key = `${merchant}|${amount}`
    setManualRules(prev => new Map(prev).set(key, catId))
  }

  function approveAll() {
    setTxns(prev => prev.map(t => ({ ...t, status: 'approved' })))
  }

  function rejectAll() {
    setTxns(prev => prev.map(t => ({ ...t, status: 'rejected' })))
  }

  async function handleImport() {
    setImporting(true)

    // Save all manual category rules to the database before importing
    // This means next month's import will auto-apply these
    for (const [key, categoryId] of Array.from(manualRules)) {
      const [merchant, amountStr] = key.split('|')
      const amount = parseFloat(amountStr)

      if (!categoryId) continue

      try {
        // Check if rule already exists for this merchant+amount
        const { data: existing } = await supabase
          .from('merchant_rules')
          .select('id')
          .eq('merchant_pattern', `${merchant}|${amount}`)
          .maybeSingle()

        if (existing) {
          // Update existing rule
          await supabase.from('merchant_rules').update({
            category_id: categoryId,
          }).eq('id', existing.id)
        } else {
          // Create new rule with merchant+amount as the pattern
          await supabase.from('merchant_rules').insert({
            merchant_pattern: `${merchant}|${amount}`,
            category_id: categoryId,
            match_type: 'exact',
          })
        }
      } catch {}
    }

    const approved = txns.filter(t => t.status === 'approved')
    onImport(approved)
  }

  const approved = txns.filter(t => t.status === 'approved')
  const duplicates = txns.filter(t => t.is_duplicate_candidate)

  return (
    <div className="space-y-4 page-transition">
      {/* Header */}
      <div className="bg-card rounded-2xl border p-4">
        <h2 className="font-semibold mb-1">Review Transactions</h2>
        <p className="text-xs text-muted-foreground">
          {transactions.length} found · {approved.length} selected · {txns.filter(t => t.status === 'rejected').length} excluded
        </p>
        {duplicates.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs">
            <AlertTriangle size={12} />
            {duplicates.length} possible duplicate{duplicates.length !== 1 ? 's' : ''} deselected
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 italic">
          💡 Change a category and it auto-applies to matching transactions. Saved for next month too.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={approveAll} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30">
          Select All
        </button>
        <button onClick={rejectAll} className="flex-1 py-2.5 rounded-xl bg-rose-500/20 text-rose-400 text-sm font-medium border border-rose-500/30">
          Deselect All
        </button>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {txns.map(txn => {
          const isApproved = txn.status === 'approved'
          const wasAutoApplied = manualRules.has(`${txn.merchant}|${txn.amount}`)

          return (
            <div
              key={txn.id}
              className={cn(
                'rounded-2xl border transition-all',
                isApproved ? 'bg-card' : 'bg-card opacity-50',
                txn.is_duplicate_candidate && 'border-amber-500/40'
              )}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleStatus(txn.id)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    isApproved ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'
                  )}
                >
                  {isApproved && <Check size={12} className="text-white" strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{txn.merchant}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(txn.date, 'MMM d, yyyy')}</p>
                    </div>
                    <span className={cn(
                      'text-sm font-semibold tabular-nums flex-shrink-0',
                      txn.amount > 0 ? 'text-emerald-400' : 'text-foreground'
                    )}>
                      {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                    </span>
                  </div>

                  {/* Category picker */}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={txn.suggested_category_id || ''}
                      onChange={e => setCategory(txn.id, e.target.value, txn.merchant, txn.amount)}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none',
                        wasAutoApplied && txn.suggested_category_id
                          ? 'bg-violet-500/20 border border-violet-500/40'
                          : 'bg-muted/50'
                      )}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                    {wasAutoApplied && txn.suggested_category_id && (
                      <span className="text-[10px] text-violet-400 flex-shrink-0">auto</span>
                    )}
                  </div>

                  {/* Flags */}
                  {txn.is_duplicate_candidate && (
                    <div className="mt-1.5">
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                        Possible duplicate
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Import button */}
      <div className="sticky bottom-20 pt-2">
        <button
          onClick={handleImport}
          disabled={approved.length === 0 || importing}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white rounded-2xl py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          {importing ? (
            <><Loader2 size={16} className="animate-spin" /> Saving rules & importing...</>
          ) : (
            <>Import {approved.length} Transaction{approved.length !== 1 ? 's' : ''}</>
          )}
        </button>
        <button onClick={onCancel} className="w-full text-center text-muted-foreground text-sm py-3">
          Cancel
        </button>
      </div>
    </div>
  )
}
