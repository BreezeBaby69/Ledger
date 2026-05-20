'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Check, X, ChevronDown, AlertTriangle, Loader2 } from 'lucide-react'
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
      status: (t.is_transfer_candidate || t.is_duplicate_candidate) ? 'pending' : 'approved',
    }))
  )
  const [categories, setCategories] = useState<Category[]>([])
  const [importing, setImporting] = useState(false)
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

  function setCategory(id: string, catId: string) {
    setTxns(prev => prev.map(t => t.id === id ? { ...t, suggested_category_id: catId } : t))
  }

  function approveAll() {
    setTxns(prev => prev.map(t => ({ ...t, status: 'approved' })))
  }

  function rejectAll() {
    setTxns(prev => prev.map(t => ({ ...t, status: 'rejected' })))
  }

  const approved = txns.filter(t => t.status === 'approved')
  const rejected = txns.filter(t => t.status === 'rejected')
  const flagged = txns.filter(t => t.is_transfer_candidate || t.is_duplicate_candidate)

  async function handleImport() {
    setImporting(true)
    onImport(approved)
  }

  return (
    <div className="space-y-4 page-transition">
      {/* Header */}
      <div className="bg-card rounded-2xl border p-4">
        <h2 className="font-semibold mb-1">Review Transactions</h2>
        <p className="text-xs text-muted-foreground">
          {transactions.length} found · {approved.length} selected · {rejected.length} excluded
        </p>
        {flagged.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs">
            <AlertTriangle size={12} />
            {flagged.length} flagged for review (transfers or duplicates)
          </div>
        )}
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
          const cat = categories.find(c => c.id === txn.suggested_category_id)
          const isFlagged = txn.is_transfer_candidate || txn.is_duplicate_candidate

          return (
            <div
              key={txn.id}
              className={cn(
                'rounded-2xl border transition-all',
                isApproved ? 'bg-card' : 'bg-card opacity-50',
                isFlagged && isApproved && 'border-amber-500/40'
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

                {/* Content */}
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
                  <div className="mt-2">
                    <select
                      value={txn.suggested_category_id || ''}
                      onChange={e => setCategory(txn.id, e.target.value)}
                      className="w-full bg-muted/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Flags */}
                  {isFlagged && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {txn.is_transfer_candidate && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                          Possible transfer
                        </span>
                      )}
                      {txn.is_duplicate_candidate && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">
                          Possible duplicate
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Import button */}
      <div className="sticky bottom-4 pt-2">
        <button
          onClick={handleImport}
          disabled={approved.length === 0 || importing}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white rounded-2xl py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          {importing ? (
            <><Loader2 size={16} className="animate-spin" /> Importing...</>
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
