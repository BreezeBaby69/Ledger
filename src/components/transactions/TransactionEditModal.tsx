'use client'

import { useState } from 'react'
import type { Transaction, Category, Account } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { X, Trash2, Check, Split } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  onClose: () => void
  onSave: () => void
}

export default function TransactionEditModal({ transaction, categories, accounts, onClose, onSave }: Props) {
  const [merchant, setMerchant] = useState(transaction.merchant)
  const [categoryId, setCategoryId] = useState(transaction.category_id || '')
  const [accountId, setAccountId] = useState(transaction.account_id)
  const [date, setDate] = useState(transaction.date)
  const [notes, setNotes] = useState(transaction.notes || '')
  const [isTransfer, setIsTransfer] = useState(transaction.is_transfer)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    await supabase.from('transactions').update({
      merchant,
      category_id: categoryId || null,
      account_id: accountId,
      date,
      notes: notes || null,
      is_transfer: isTransfer,
    }).eq('id', transaction.id)

    // Learn from this correction — create/update merchant rule
    if (categoryId && merchant !== transaction.merchant || categoryId !== transaction.category_id) {
      const { data: existing } = await supabase
        .from('merchant_rules')
        .select('id')
        .eq('merchant_pattern', merchant)
        .single()

      if (existing) {
        await supabase.from('merchant_rules').update({ category_id: categoryId }).eq('id', existing.id)
      } else if (categoryId) {
        await supabase.from('merchant_rules').insert({
          merchant_pattern: merchant,
          category_id: categoryId,
          match_type: 'contains',
        })
      }
    }

    setSaving(false)
    onSave()
  }

  async function handleDelete() {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', transaction.id)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl border-t border-x safe-bottom z-10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-semibold">Edit Transaction</h2>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Amount display */}
        <div className="px-5 py-4 border-b text-center">
          <p className={cn(
            'text-3xl font-semibold tabular-nums',
            transaction.amount > 0 ? 'text-emerald-400' : 'text-foreground'
          )}>
            {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(date, 'MMMM d, yyyy')}</p>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Merchant</label>
            <input
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Category</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              <option value="">Uncategorized</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Account</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>

          {/* Transfer toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <div>
              <p className="text-sm font-medium">Mark as Transfer</p>
              <p className="text-xs text-muted-foreground">Exclude from spending totals</p>
            </div>
            <button
              onClick={() => setIsTransfer(!isTransfer)}
              className={cn(
                'w-11 h-6 rounded-full transition-all duration-200 relative',
                isTransfer ? 'bg-violet-500' : 'bg-muted-foreground/30'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200',
                isTransfer ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="px-5 pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-violet-500 hover:bg-violet-600 text-white rounded-2xl py-3.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : (
              <><Check size={16} /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
