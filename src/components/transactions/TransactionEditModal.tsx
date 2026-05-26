'use client'

import { useState, useEffect, useRef } from 'react'
import type { Transaction, Category, Account } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { X, Trash2, Check } from 'lucide-react'
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
  const [isTransfer, setIsTransfer] = useState(!!transaction.is_transfer)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Use a ref to always have the latest isTransfer value at save time
  const isTransferRef = useRef(!!transaction.is_transfer)

  function toggleTransfer() {
    const newVal = !isTransferRef.current
    isTransferRef.current = newVal
    setIsTransfer(newVal)
  }

  const supabase = createClient()

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    
    const updatePayload = {
      merchant,
      category_id: categoryId || null,
      account_id: accountId,
      date,
      notes: notes || null,
      is_transfer: isTransferRef.current, // use ref, not state
    }

    const { error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', transaction.id)

    if (error) {
      alert('Failed to save: ' + error.message)
      setSaving(false)
      return
    }

    // Learn from category correction
    if (categoryId && categoryId !== transaction.category_id) {
      try {
        const { data: existing } = await supabase
          .from('merchant_rules')
          .select('id')
          .eq('merchant_pattern', merchant)
          .maybeSingle()

        if (existing) {
          await supabase.from('merchant_rules').update({ category_id: categoryId }).eq('id', existing.id)
        } else {
          await supabase.from('merchant_rules').insert({
            merchant_pattern: merchant,
            category_id: categoryId,
            match_type: 'contains',
          })
        }
      } catch {}
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => onSave(), 800)
  }

  async function handleDelete() {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', transaction.id)
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card rounded-t-3xl border-t border-x z-10 flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
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

        <div className="px-5 py-4 border-b text-center flex-shrink-0">
          <p className={cn('text-3xl font-semibold tabular-nums', transaction.amount > 0 ? 'text-emerald-400' : 'text-foreground')}>
            {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(date, 'MMMM d, yyyy')}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Merchant</label>
            <input value={merchant} onChange={e => setMerchant(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50">
              <option value="">Uncategorized</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50">
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note..."
              className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
          </div>

          {/* Transfer toggle — shows current value clearly */}
          <div className="rounded-xl border overflow-hidden">
            <div
              className={cn(
                'flex items-center justify-between p-4 cursor-pointer transition-colors',
                isTransfer ? 'bg-violet-500/15 border-violet-500/30' : 'bg-muted/50'
              )}
              onClick={toggleTransfer}
            >
              <div>
                <p className="text-sm font-medium">
                  {isTransfer ? '✓ Marked as Transfer' : 'Mark as Transfer'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isTransfer
                    ? 'Excluded from spending & income'
                    : 'Tap to exclude from totals'}
                </p>
              </div>
              <div className={cn(
                'w-12 h-7 rounded-full transition-all duration-200 relative flex-shrink-0 ml-4',
                isTransfer ? 'bg-violet-500' : 'bg-muted-foreground/30'
              )}>
                <div className={cn(
                  'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200',
                  isTransfer ? 'left-6' : 'left-1'
                )} />
              </div>
            </div>
          </div>

          <div className="h-2" />
        </div>

        <div className="px-5 pt-3 border-t flex-shrink-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              'w-full text-white rounded-2xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2',
              saved ? 'bg-emerald-500' : 'bg-violet-500 hover:bg-violet-600 disabled:opacity-50'
            )}
          >
            {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving...' : <><Check size={16} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
