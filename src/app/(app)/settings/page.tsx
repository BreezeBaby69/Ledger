'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, CheckCircle, AlertCircle, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
]

const CATEGORY_ICONS = [
  '🛒','🍽️','⛽','🛍️','🎬','✈️','💡','🛡️','🏠','🎉',
  '📱','↔️','💳','↩️','💵','📦','🏥','🐾','👶','🎓',
  '🚗','🏋️','💊','🎮','📚','🍺','☕','🌿','🎵','🏦',
]

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [addingAccount, setAddingAccount] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [tab, setTab] = useState<'accounts' | 'categories' | 'rules'>('accounts')
  const [newAcct, setNewAcct] = useState({ name: '', type: 'checking', institution: '', last_four: '', credit_limit: '', color: '#10b981' })
  const [newCat, setNewCat] = useState({ name: '', color: '#10b981', icon: '📦' })
  const [editCat, setEditCat] = useState({ name: '', color: '', icon: '' })
  const [saving, setSaving] = useState(false)
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

    const { data: cats } = await supabase.from('categories').select('*').order('name')
    setCategories(cats || [])
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
      name: newCat.name.trim(), color: newCat.color, icon: newCat.icon, is_system: false,
    })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Category added!', 'success'); setAddingCategory(false); setNewCat({ name: '', color: '#10b981', icon: '📦' }); loadData() }
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
    if (!confirm(`Delete "${name}"? Transactions in this category will become uncategorized.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Category deleted', 'success'); loadData() }
  }

  function startEditCategory(cat: any) {
    setEditingCategory(cat.id)
    setEditCat({ name: cat.name, color: cat.color, icon: cat.icon })
  }

  return (
    <div className="space-y-4 page-transition">
      {toast && (
        <div className={cn('fixed top-20 left-4 right-4 max-w-md mx-auto z-50 flex items-center gap-3 p-4 rounded-2xl shadow-lg',
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {(['accounts', 'categories', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
            {t}
          </button>
        ))}
      </div>

      {/* ACCOUNTS TAB */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          {accounts.length === 0 && !addingAccount && (
            <div className="bg-card rounded-2xl border p-8 text-center">
              <p className="text-muted-foreground text-sm">No accounts yet.</p>
            </div>
          )}
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-card rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: acc.color + '22', border: `1px solid ${acc.color}44` }}>
                    {ACCOUNT_TYPES.find(t => t.value === acc.type)?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">{acc.institution}{acc.last_four && ` •••• ${acc.last_four}`} · {acc.type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(acc.balance)}</p>
                    <button onClick={() => deleteAccount(acc.id)} className="text-xs text-destructive/70 hover:text-destructive">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {addingAccount ? (
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <h3 className="font-medium text-sm">New Account</h3>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewAcct(p => ({ ...p, type: t.value }))}
                    className={cn('p-3 rounded-xl border text-center transition-all',
                      newAcct.type === t.value ? 'border-violet-500 bg-violet-500/10' : 'border-border hover:bg-muted')}>
                    <div className="text-xl mb-1">{t.icon}</div>
                    <p className="text-xs font-medium">{t.label}</p>
                  </button>
                ))}
              </div>
              <input placeholder="Account name" value={newAcct.name} onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
              <input placeholder="Institution (e.g. BMO)" value={newAcct.institution} onChange={e => setNewAcct(p => ({ ...p, institution: e.target.value }))}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
              <input placeholder="Last 4 digits (optional)" value={newAcct.last_four} onChange={e => setNewAcct(p => ({ ...p, last_four: e.target.value }))} maxLength={4}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
              {newAcct.type === 'credit_card' && (
                <input placeholder="Credit limit (optional)" type="number" value={newAcct.credit_limit} onChange={e => setNewAcct(p => ({ ...p, credit_limit: e.target.value }))}
                  className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map(c => (
                    <button key={c} onClick={() => setNewAcct(p => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: newAcct.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addAccount} disabled={saving} className="flex-1 bg-violet-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Account'}
                </button>
                <button onClick={() => setAddingAccount(false)} className="flex-1 bg-muted text-muted-foreground rounded-xl py-2.5 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingAccount(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-violet-500/50 text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={16} /><span className="text-sm font-medium">Add Account</span>
            </button>
          )}
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Tap the pencil icon to rename, recolor, or change the icon. You can also add your own custom categories.</p>

          <div className="bg-card rounded-2xl border overflow-hidden">
            {categories.map((cat, i) => (
              <div key={cat.id} className={cn('px-4 py-3', i !== categories.length - 1 && 'border-b')}>
                {editingCategory === cat.id ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input value={editCat.name} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))}
                        className="flex-1 bg-muted/50 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
                      <button onClick={() => saveCategory(cat.id)} className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingCategory(null)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
                        <X size={14} />
                      </button>
                    </div>
                    {/* Icon picker */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Icon</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORY_ICONS.map(icon => (
                          <button key={icon} onClick={() => setEditCat(p => ({ ...p, icon }))}
                            className={cn('w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all',
                              editCat.icon === icon ? 'bg-violet-500/30 ring-2 ring-violet-500' : 'hover:bg-muted')}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Color picker */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Colour</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_COLORS.map(c => (
                          <button key={c} onClick={() => setEditCat(p => ({ ...p, color: c }))}
                            className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                            style={{ backgroundColor: c, outline: editCat.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
                        ))}
                      </div>
                    </div>
                    {!cat.is_system && (
                      <button onClick={() => deleteCategory(cat.id, cat.name)}
                        className="text-xs text-destructive/70 hover:text-destructive flex items-center gap-1">
                        <Trash2 size={12} /> Delete category
                      </button>
                    )}
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: cat.color + '22' }}>
                      {cat.icon}
                    </div>
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <button onClick={() => startEditCategory(cat)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          {addingCategory ? (
            <div className="bg-card rounded-2xl border p-4 space-y-3">
              <h3 className="font-medium text-sm">New Category</h3>
              <input placeholder="Category name (e.g. Pet Care)" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Icon</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewCat(p => ({ ...p, icon }))}
                      className={cn('w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all',
                        newCat.icon === icon ? 'bg-violet-500/30 ring-2 ring-violet-500' : 'hover:bg-muted')}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} onClick={() => setNewCat(p => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: newCat.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addCategory} disabled={saving} className="flex-1 bg-violet-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Category'}
                </button>
                <button onClick={() => setAddingCategory(false)} className="flex-1 bg-muted text-muted-foreground rounded-xl py-2.5 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-violet-500/50 text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={16} /><span className="text-sm font-medium">Add Custom Category</span>
            </button>
          )}
        </div>
      )}

      {/* RULES TAB */}
      {tab === 'rules' && <MerchantRules />}

      <div className="pt-4 pb-2 text-center space-y-1">
        <p className="text-xs text-muted-foreground">Ledger — Personal Budget · v0.1.0</p>
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
      <p className="text-xs text-muted-foreground">Rules are created automatically when you recategorize transactions.</p>
      <div className="bg-card rounded-2xl border overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No rules yet. Edit a transaction's category to create one.</div>
        ) : (
          rules.map((rule, i) => (
            <div key={rule.id} className={cn('flex items-center gap-3 px-4 py-3', i !== rules.length - 1 && 'border-b')}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">"{rule.merchant_pattern}"</p>
                <p className="text-xs text-muted-foreground">→ {rule.category?.icon} {rule.category?.name}</p>
              </div>
              <button onClick={() => deleteRule(rule.id)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
