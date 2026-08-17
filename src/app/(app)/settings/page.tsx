'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, CheckCircle, AlertCircle, Pencil, Check, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', icon: '🏦' },
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
]

const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4']

const CATEGORY_COLORS = [
  '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e',
  '#06b6d4', '#64748b', '#7c3aed', '#ec4899', '#6366f1',
  '#475569', '#94a3b8', '#ef4444', '#84cc16', '#f97316',
  '#00f5ff', '#00ff88', '#ff6b00', '#ff3b5c', '#9b5de5',
]

const CATEGORY_ICONS = [
  '🛒','🍽️','⛽','🛍️','🎬','✈️','💡','🛡️','🏠','🎉',
  '📱','↔️','💳','↩️','💵','📦','🏥','🐾','👶','🎓',
  '🚗','🏋️','💊','🎮','📚','🍺','☕','🌿','🎵','🏦',
  '💼','🏛️','⚡','📈','💰',
]

interface ImportBatch {
  batch_id: string
  account_name: string
  account_id: string
  count: number
  total_amount: number
  imported_at: string
  date_range: string
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([])
  const [addingAccount, setAddingAccount] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<'accounts' | 'categories' | 'history' | 'rules'>('accounts')
  const [newAcct, setNewAcct] = useState({ name: '', type: 'checking', institution: '', last_four: '', credit_limit: '', color: '#10b981' })
  const [newCat, setNewCat] = useState({ name: '', color: '#00f5ff', icon: '📦', type: 'expense' })
  const [editCat, setEditCat] = useState({ name: '', color: '', icon: '' })
  const [saving, setSaving] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadData() {
    const { data: accs, error: accErr } = await supabase.from('accounts').select('*').order('created_at')
    if (accErr) showToast('Failed to load accounts: ' + accErr.message, 'error')
    else setAccounts(accs || [])

    const { data: cats } = await supabase.from('categories').select('*').order('type').order('name')
    setCategories(cats || [])

    // Load import history — group by batch_id
    const { data: batches } = await supabase
      .from('transactions')
      .select('import_batch_id, account_id, amount, created_at, date, account:accounts(name)')
      .not('import_batch_id', 'is', null)
      .order('created_at', { ascending: false })

    if (batches) {
      const batchMap: Record<string, ImportBatch> = {}
      for (const t of batches) {
        const bid = t.import_batch_id
        if (!batchMap[bid]) {
          batchMap[bid] = {
            batch_id: bid,
            account_id: t.account_id,
            account_name: (t.account as any)?.name || 'Unknown',
            count: 0,
            total_amount: 0,
            imported_at: t.created_at,
            date_range: t.date,
          }
        }
        batchMap[bid].count++
        batchMap[bid].total_amount += t.amount
        // Track date range
        if (t.date < batchMap[bid].date_range) batchMap[bid].date_range = t.date
      }
      setImportBatches(
        Object.values(batchMap)
          .sort((a, b) => b.imported_at.localeCompare(a.imported_at))
          .slice(0, 20)
      )
    }
  }

  async function undoBatch(batchId: string, count: number) {
    if (!confirm(`Delete all ${count} transactions from this import? This cannot be undone.`)) return
    setUndoing(batchId)
    const { error } = await supabase.from('transactions').delete().eq('import_batch_id', batchId)
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast(`Deleted ${count} transactions`, 'success'); loadData() }
    setUndoing(null)
  }

  async function addAccount() {
    if (!newAcct.name || !newAcct.institution) { showToast('Please fill in account name and institution', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('accounts').insert({
      name: newAcct.name.trim(), type: newAcct.type,
      institution: newAcct.institution.trim(),
      last_four: newAcct.last_four || null,
      credit_limit: newAcct.type === 'credit_card' && newAcct.credit_limit ? parseFloat(newAcct.credit_limit) : null,
      color: newAcct.color, balance: 0, currency: 'CAD',
    })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Account added!', 'success'); setAddingAccount(false); setNewAcct({ name: '', type: 'checking', institution: '', last_four: '', credit_limit: '', color: '#10b981' }); loadData() }
    setSaving(false)
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account and all its transactions?')) return
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Account deleted', 'success'); loadData() }
  }

  async function addCategory() {
    if (!newCat.name) { showToast('Please enter a category name', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('categories').insert({
      name: newCat.name.trim(), color: newCat.color, icon: newCat.icon, is_system: false, type: newCat.type,
    })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Category added!', 'success'); setAddingCategory(false); setNewCat({ name: '', color: '#00f5ff', icon: '📦', type: 'expense' }); loadData() }
    setSaving(false)
  }

  async function saveCategory(id: string) {
    const { error } = await supabase.from('categories').update({
      name: editCat.name, color: editCat.color, icon: editCat.icon,
    }).eq('id', id)
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Category updated!', 'success'); setEditingCategory(null); loadData() }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Transactions will become uncategorized.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Category deleted', 'success'); loadData() }
  }

  function startEditCategory(cat: any) {
    setEditingCategory(cat.id)
    setEditCat({ name: cat.name, color: cat.color, icon: cat.icon })
  }

  const expenseCategories = categories.filter(c => c.type !== 'income')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const optStyle = (active: boolean) => ({
    fontFamily: 'var(--font-display)',
    fontSize: '10px',
    letterSpacing: '0.15em',
    borderRadius: '2px',
    color: active ? 'var(--cyan)' : 'var(--text-muted)',
    background: active ? 'rgba(0,245,255,0.08)' : 'transparent',
    border: active ? '1px solid var(--border-cyan-active)' : '1px solid transparent',
  })

  return (
    <div className="space-y-4 page-transition">
      {toast && (
        <div className={cn('fixed top-20 left-4 right-4 max-w-md mx-auto z-50 flex items-center gap-3 p-4 shadow-lg')}
          style={{ background: toast.type === 'success' ? 'var(--green)' : 'var(--red)', color: '#000', borderRadius: '2px' }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em' }}>{toast.message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="opt-card flex" style={{ padding: '4px', gap: '3px' }}>
        {(['accounts', 'categories', 'history', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 transition-all" style={optStyle(tab === t)}>
            {t === 'history' ? 'HISTORY' : t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ACCOUNTS */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          {accounts.length === 0 && !addingAccount && (
            <div className="opt-card p-8 text-center">
              <p className="opt-label">NO ACCOUNTS YET</p>
            </div>
          )}
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} className="opt-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center text-lg"
                    style={{ background: acc.color + '22', border: `1px solid ${acc.color}44`, borderRadius: '2px' }}>
                    {ACCOUNT_TYPES.find(t => t.value === acc.type)?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>{acc.name}</p>
                    <p className="opt-label" style={{ marginTop: '2px' }}>{acc.institution}{acc.last_four && ` ···· ${acc.last_four}`} · {acc.type.replace('_', ' ')}</p>
                  </div>
                  <button onClick={() => deleteAccount(acc.id)} style={{ color: 'var(--red)', fontSize: '10px', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>REMOVE</button>
                </div>
              </div>
            ))}
          </div>

          {addingAccount ? (
            <div className="opt-card p-4 space-y-3">
              <p className="opt-label">// NEW ACCOUNT</p>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewAcct(p => ({ ...p, type: t.value }))}
                    className="p-3 text-center transition-all"
                    style={{ border: `1px solid ${newAcct.type === t.value ? 'var(--cyan)' : 'var(--border-cyan)'}`, background: newAcct.type === t.value ? 'rgba(0,245,255,0.08)' : 'transparent', borderRadius: '2px' }}>
                    <div className="text-xl mb-1">{t.icon}</div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.1em', color: newAcct.type === t.value ? 'var(--cyan)' : 'var(--text-muted)' }}>{t.label.toUpperCase()}</p>
                  </button>
                ))}
              </div>
              <input placeholder="ACCOUNT NAME" value={newAcct.name} onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))} className="opt-input" />
              <input placeholder="INSTITUTION (E.G. BMO)" value={newAcct.institution} onChange={e => setNewAcct(p => ({ ...p, institution: e.target.value }))} className="opt-input" />
              <input placeholder="LAST 4 DIGITS (OPTIONAL)" value={newAcct.last_four} onChange={e => setNewAcct(p => ({ ...p, last_four: e.target.value }))} maxLength={4} className="opt-input" />
              {newAcct.type === 'credit_card' && (
                <input placeholder="CREDIT LIMIT (OPTIONAL)" type="number" value={newAcct.credit_limit} onChange={e => setNewAcct(p => ({ ...p, credit_limit: e.target.value }))} className="opt-input" />
              )}
              <div>
                <p className="opt-label mb-2">COLOUR</p>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map(c => (
                    <button key={c} onClick={() => setNewAcct(p => ({ ...p, color: c }))}
                      className="w-8 h-8 transition-transform hover:scale-110"
                      style={{ background: c, outline: newAcct.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', borderRadius: '2px' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addAccount} disabled={saving} className="opt-btn-primary flex-1 py-2.5">
                  {saving ? 'SAVING...' : 'ADD ACCOUNT'}
                </button>
                <button onClick={() => setAddingAccount(false)} className="opt-btn flex-1 py-2.5">CANCEL</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingAccount(true)} className="w-full flex items-center justify-center gap-2 p-4"
              style={{ border: '1px dashed var(--border-cyan)', borderRadius: '2px', color: 'var(--text-muted)' }}>
              <Plus size={14} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em' }}>ADD ACCOUNT</span>
            </button>
          )}
        </div>
      )}

      {/* CATEGORIES */}
      {tab === 'categories' && (
        <div className="space-y-4">
          {/* Expense categories */}
          <div>
            <p className="opt-label mb-2">// EXPENSE CATEGORIES</p>
            <div className="opt-card overflow-hidden">
              {expenseCategories.map((cat, i) => (
                <div key={cat.id} className={cn('px-4 py-3', i !== expenseCategories.length - 1 && 'opt-row')}>
                  {editingCategory === cat.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input value={editCat.name} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} className="opt-input flex-1" style={{ padding: '8px 10px' }} />
                        <button onClick={() => saveCategory(cat.id)} className="p-2" style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '2px', color: 'var(--green)' }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingCategory(null)} className="p-2" style={{ color: 'var(--text-muted)' }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div>
                        <p className="opt-label mb-1.5">ICON</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_ICONS.map(icon => (
                            <button key={icon} onClick={() => setEditCat(p => ({ ...p, icon }))}
                              className="w-8 h-8 flex items-center justify-center text-base transition-all"
                              style={{ background: editCat.icon === icon ? 'rgba(0,245,255,0.15)' : 'transparent', border: editCat.icon === icon ? '1px solid var(--cyan)' : '1px solid transparent', borderRadius: '2px' }}>
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="opt-label mb-1.5">COLOUR</p>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORY_COLORS.map(c => (
                            <button key={c} onClick={() => setEditCat(p => ({ ...p, color: c }))}
                              className="w-7 h-7 transition-transform hover:scale-110"
                              style={{ background: c, outline: editCat.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', borderRadius: '2px' }} />
                          ))}
                        </div>
                      </div>
                      {!cat.is_system && (
                        <button onClick={() => deleteCategory(cat.id, cat.name)}
                          className="flex items-center gap-1 text-xs" style={{ color: 'var(--red)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: '9px' }}>
                          <Trash2 size={12} /> DELETE CATEGORY
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: cat.color + '22', borderRadius: '2px' }}>
                        {cat.icon}
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-primary)', flex: 1 }}>{cat.name.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ background: cat.color, borderRadius: '1px' }} />
                        <button onClick={() => startEditCategory(cat)} className="p-1.5" style={{ color: 'var(--text-muted)' }}>
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Income categories */}
          <div>
            <p className="opt-label mb-2">// INCOME CATEGORIES</p>
            <div className="opt-card overflow-hidden">
              {incomeCategories.map((cat, i) => (
                <div key={cat.id} className={cn('px-4 py-3', i !== incomeCategories.length - 1 && 'opt-row')}>
                  {editingCategory === cat.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input value={editCat.name} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} className="opt-input flex-1" style={{ padding: '8px 10px' }} />
                        <button onClick={() => saveCategory(cat.id)} className="p-2" style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '2px', color: 'var(--green)' }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingCategory(null)} className="p-2" style={{ color: 'var(--text-muted)' }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div>
                        <p className="opt-label mb-1.5">ICON</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORY_ICONS.map(icon => (
                            <button key={icon} onClick={() => setEditCat(p => ({ ...p, icon }))}
                              className="w-8 h-8 flex items-center justify-center text-base transition-all"
                              style={{ background: editCat.icon === icon ? 'rgba(0,255,136,0.15)' : 'transparent', border: editCat.icon === icon ? '1px solid var(--green)' : '1px solid transparent', borderRadius: '2px' }}>
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="opt-label mb-1.5">COLOUR</p>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORY_COLORS.map(c => (
                            <button key={c} onClick={() => setEditCat(p => ({ ...p, color: c }))}
                              className="w-7 h-7 transition-transform hover:scale-110"
                              style={{ background: c, outline: editCat.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', borderRadius: '2px' }} />
                          ))}
                        </div>
                      </div>
                      {!cat.is_system && (
                        <button onClick={() => deleteCategory(cat.id, cat.name)}
                          className="flex items-center gap-1" style={{ color: 'var(--red)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: '9px' }}>
                          <Trash2 size={12} /> DELETE CATEGORY
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: cat.color + '22', borderRadius: '2px' }}>
                        {cat.icon}
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-primary)', flex: 1 }}>{cat.name.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3" style={{ background: cat.color, borderRadius: '1px' }} />
                        <button onClick={() => startEditCategory(cat)} className="p-1.5" style={{ color: 'var(--text-muted)' }}>
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add category */}
          {addingCategory ? (
            <div className="opt-card p-4 space-y-3">
              <p className="opt-label">// NEW CATEGORY</p>
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map(type => (
                  <button key={type} onClick={() => setNewCat(p => ({ ...p, type }))}
                    className="flex-1 py-2 transition-all"
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em', borderRadius: '2px',
                      color: newCat.type === type ? (type === 'income' ? 'var(--green)' : 'var(--cyan)') : 'var(--text-muted)',
                      background: newCat.type === type ? (type === 'income' ? 'rgba(0,255,136,0.08)' : 'rgba(0,245,255,0.08)') : 'transparent',
                      border: newCat.type === type ? `1px solid ${type === 'income' ? 'rgba(0,255,136,0.4)' : 'var(--border-cyan-active)'}` : '1px solid var(--border-cyan)',
                    }}>
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
              <input placeholder="CATEGORY NAME" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} className="opt-input" />
              <div>
                <p className="opt-label mb-1.5">ICON</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewCat(p => ({ ...p, icon }))}
                      className="w-8 h-8 flex items-center justify-center text-base transition-all"
                      style={{ background: newCat.icon === icon ? 'rgba(0,245,255,0.15)' : 'transparent', border: newCat.icon === icon ? '1px solid var(--cyan)' : '1px solid transparent', borderRadius: '2px' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="opt-label mb-1.5">COLOUR</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} onClick={() => setNewCat(p => ({ ...p, color: c }))}
                      className="w-7 h-7 transition-transform hover:scale-110"
                      style={{ background: c, outline: newCat.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', borderRadius: '2px' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addCategory} disabled={saving} className="opt-btn-primary flex-1 py-2.5">{saving ? 'SAVING...' : 'ADD CATEGORY'}</button>
                <button onClick={() => setAddingCategory(false)} className="opt-btn flex-1 py-2.5">CANCEL</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)} className="w-full flex items-center justify-center gap-2 p-4"
              style={{ border: '1px dashed var(--border-cyan)', borderRadius: '2px', color: 'var(--text-muted)' }}>
              <Plus size={14} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em' }}>ADD CUSTOM CATEGORY</span>
            </button>
          )}
        </div>
      )}

      {/* IMPORT HISTORY */}
      {tab === 'history' && (
        <div className="space-y-3">
          <p className="opt-label">// IMPORT HISTORY · LAST 20 BATCHES</p>
          {importBatches.length === 0 ? (
            <div className="opt-card p-8 text-center">
              <p className="opt-label">NO IMPORTS YET</p>
            </div>
          ) : (
            <div className="opt-card overflow-hidden">
              {importBatches.map((batch, i) => (
                <div key={batch.batch_id} className={cn('p-4', i !== importBatches.length - 1 && 'opt-row')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
                        {batch.account_name.toUpperCase()}
                      </p>
                      <p className="opt-label" style={{ marginTop: '3px' }}>
                        {format(new Date(batch.imported_at), 'MMM d, yyyy · h:mm a').toUpperCase()}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--cyan)' }}>
                          {batch.count} TXN
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: batch.total_amount >= 0 ? 'var(--green)' : 'var(--orange)' }}>
                          {batch.total_amount >= 0 ? '+' : ''}{formatCurrency(batch.total_amount)}
                        </span>
                        <span className="opt-label">FROM {format(new Date(batch.date_range), 'MMM d').toUpperCase()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => undoBatch(batch.batch_id, batch.count)}
                      disabled={undoing === batch.batch_id}
                      className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0 transition-all"
                      style={{
                        fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.15em',
                        border: '1px solid var(--red)', color: 'var(--red)', borderRadius: '2px',
                        opacity: undoing === batch.batch_id ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={12} />
                      {undoing === batch.batch_id ? 'DELETING...' : 'UNDO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RULES */}
      {tab === 'rules' && <MerchantRules />}

      <div className="pt-4 pb-2 text-center">
        <p className="opt-label">OPTIMIZE · PERSONAL FINANCE · v1.0</p>
      </div>
    </div>
  )
}

function MerchantRules() {
  const [rules, setRules] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('merchant_rules').select('*, category:categories(*)').order('created_at', { ascending: false }).then(({ data }) => setRules(data || []))
  }, [])

  async function deleteRule(id: string) {
    await supabase.from('merchant_rules').delete().eq('id', id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-2">
      <p className="opt-label">// AUTO-CATEGORIZATION RULES</p>
      <div className="opt-card overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-6 text-center">
            <p className="opt-label">NO RULES YET</p>
            <p className="opt-label" style={{ marginTop: '4px', opacity: 0.5 }}>EDIT A TRANSACTION CATEGORY TO CREATE ONE</p>
          </div>
        ) : (
          rules.map((rule, i) => (
            <div key={rule.id} className={cn('flex items-center gap-3 px-4 py-3', i !== rules.length - 1 && 'opt-row')}>
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }} className="truncate">"{rule.merchant_pattern}"</p>
                <p className="opt-label" style={{ marginTop: '2px' }}>→ {rule.category?.icon} {rule.category?.name?.toUpperCase()}</p>
              </div>
              <button onClick={() => deleteRule(rule.id)} className="p-1.5" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
