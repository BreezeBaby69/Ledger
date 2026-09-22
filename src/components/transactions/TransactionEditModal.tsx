'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { Transaction, Category, Account } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { X, Trash2, Check, Link2, Unlink, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  onClose: () => void
  onSave: () => void
}

interface LinkCandidate {
  id: string
  date: string
  merchant: string
  amount: number
  category_id: string | null
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

  // --- Linking state ---
  const isRefund = transaction.amount > 0
  const [linkedTransactionId, setLinkedTransactionId] = useState<string | null>(
    (transaction as any).linked_transaction_id || null
  )
  const linkedTransactionIdRef = useRef<string | null>(linkedTransactionId)
  const [linkedOriginal, setLinkedOriginal] = useState<LinkCandidate | null>(null)
  const [linkedRefunds, setLinkedRefunds] = useState<LinkCandidate[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<LinkCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

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

  // Load existing link info on mount
  useEffect(() => {
    async function loadLinkInfo() {
      if (isRefund && linkedTransactionId) {
        const { data } = await supabase
          .from('transactions')
          .select('id, date, merchant, amount, category_id')
          .eq('id', linkedTransactionId)
          .maybeSingle()
        if (data) setLinkedOriginal(data as LinkCandidate)
      } else if (!isRefund) {
        const { data } = await supabase
          .from('transactions')
          .select('id, date, merchant, amount, category_id')
          .eq('linked_transaction_id', transaction.id)
        setLinkedRefunds(data || [])
      }
    }
    loadLinkInfo()
  }, [])

  // Fetch candidates when picker opens (opposite sign, same account, excluding self)
  useEffect(() => {
    if (!showPicker) return
    async function loadCandidates() {
      setLoadingCandidates(true)
      let query = supabase
        .from('transactions')
        .select('id, date, merchant, amount, category_id')
        .eq('account_id', accountId)
        .neq('id', transaction.id)
        .order('date', { ascending: false })
        .limit(200)

      if (isRefund) {
        query = query.lt('amount', 0)
      } else {
        query = query.gt('amount', 0)
      }

      const { data } = await query
      setCandidates(data || [])
      setLoadingCandidates(false)
    }
    loadCandidates()
  }, [showPicker])

  const filteredCandidates = useMemo(() => {
    if (!search.trim()) return candidates
    const term = search.toLowerCase()
    return candidates.filter(c =>
      c.merchant.toLowerCase().includes(term) ||
      formatCurrency(c.amount).toLowerCase().includes(term)
    )
  }, [candidates, search])

  function linkTo(candidate: LinkCandidate) {
    linkedTransactionIdRef.current = candidate.id
    setLinkedTransactionId(candidate.id)
    setLinkedOriginal(candidate)
    setShowPicker(false)
    setSearch('')

    if (candidate.category_id) {
      setCategoryId(candidate.category_id)
    }
  }

  function unlink() {
    linkedTransactionIdRef.current = null
    setLinkedTransactionId(null)
    setLinkedOriginal(null)
  }

  const netAmount = transaction.amount + linkedRefunds.reduce((sum, r) => sum + r.amount, 0)

  async function handleSave() {
    setSaving(true)

    const updatePayload = {
      merchant,
      category_id: categoryId || null,
      account_id: accountId,
      date,
      notes: notes || null,
      is_transfer: isTransferRef.current,
      linked_transaction_id: isRefund ? linkedTransactionIdRef.current : (transaction as any).linked_transaction_id ?? null,
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

          {!isRefund && linkedRefunds.length > 0 && (
            <p className="text-xs mt-2">
              <span className="text-emerald-400">
                Refunded: {formatCurrency(linkedRefunds.reduce((s, r) => s + r.amount, 0))}
              </span>
              {' · '}
              <span className="text-muted-foreground">Net: {formatCurrency(netAmount)}</span>
            </p>
          )}
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

          {/* Refund linking — only shown on positive (refund) transactions */}
          {isRefund && (
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Refund Of</label>

              {linkedOriginal ? (
                <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl p-3">
                  <Link2 size={16} className="text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{linkedOriginal.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(linkedOriginal.date, 'MMM d, yyyy')} · {formatCurrency(linkedOriginal.amount)}
                    </p>
                  </div>
                  <button onClick={unlink} className="p-1.5 hover:bg-muted rounded-lg flex-shrink-0" title="Unlink">
                    <Unlink size={14} className="text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-full flex items-center justify-center gap-2 bg-muted/50 border border-dashed rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Link2 size={14} /> Link to original expense
                </button>
              )}
            </div>
          )}

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

      {/* Full-screen link picker — sits above the edit modal */}
      {showPicker && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-card">
          <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
            <h2 className="font-semibold">Link to Expense</h2>
            <button onClick={() => { setShowPicker(false); setSearch('') }} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-b flex-shrink-0">
            <Search size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search merchant or amount (optional)..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-1 hover:bg-muted rounded-lg flex-shrink-0">
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {loadingCandidates && (
              <p className="text-sm text-muted-foreground text-center py-8">Loading transactions...</p>
            )}
            {!loadingCandidates && filteredCandidates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No matching transactions found</p>
            )}
            {filteredCandidates.map(c => (
              <button
                key={c.id}
                onClick={() => linkTo(c)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50 active:bg-muted transition-colors text-left border-b"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.merchant}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.date, 'MMM d, yyyy')}</p>
                </div>
                <span className="text-base font-semibold tabular-nums flex-shrink-0">
                  {formatCurrency(c.amount)}
                </span>
              </button>
            ))}
            <div style={{ height: 'env(safe-area-inset-bottom)' }} />
          </div>
        </div>
      )}
    </div>
  )
}
