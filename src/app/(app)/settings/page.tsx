'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', icon: '🏦' },
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
]

const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4']

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [addingAccount, setAddingAccount] = useState(false)
  const [tab, setTab] = useState<'accounts' | 'categories' | 'rules'>('accounts')
  const [newAcct, setNewAcct] = useState({ name: '', type: 'checking', institution: '', last_four: '', credit_limit: '', color: '#10b981' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadData() {
    const { data: accs, error: accErr } = await supabase.from('accounts').select('*').order('created_at')
    if (accErr) {
      showToast('Failed to load accounts: ' + accErr.message, 'error')
    } else {
      setAccounts(accs || [])
    }

    const { data: cats } = await supabase.from('categories').select('*').order('name')
    setCategories(cats || [])
  }

  async function addAccount() {
    if (!newAcct.name || !newAcct.institution) {
      showToast('Please fill in account name and institution', 'error')
      return
    }
    setSaving(true)

    const payload = {
      name: newAcct.name.trim(),
      type: newAcct.type,
      institution: newAcct.institution.trim(),
      last_four: newAcct.last_four || null,
      credit_limit: newAcct.type === 'credit_card' && newAcct.credit_limit ? parseFloat(newAcct.credit_limit) : null,
      color: newAcct.color,
      balance: 0,
      currency: 'CAD',
    }

    const { data, error } = await supabase.from('accounts').insert(payload).select().single()

    if (error) {
      showToast('Error saving account: ' + error.message, 'error')
    } else {
      showToast('Account added successfully!', 'success')
      setAddingAccount(false)
      setNewAcct({ name: '', type: 'checking', institution: '', last_four: '', credit_limit: '', color: '#10b981' })
      loadData()
    }
    setSaving(false)
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? All transactions will also be deleted.')) return
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) {
      showToast('Error deleting account: ' + error.message, 'error')
    } else {
      showToast('Account deleted', 'success')
      loadData()
    }
  }

  return (
    <div className="space-y-4 page-transition">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-20 left-4 right-4 max-w-md mx-auto z-50 flex items-center gap-3 p-4 rounded-2xl shadow-lg',
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        )}>
          {toast.type === 'success'
            ? <CheckCircle size={18} />
            : <AlertCircle size={18} />
          }
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {(['accounts', 'categories', 'rules'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Accounts Tab */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          {accounts.length === 0 && !addingAccount && (
            <div className="bg-card rounded-2xl border p-8 text-center">
              <p className="text-muted-foreground text-sm">No accounts yet. Add your first one below.</p>
            </div>
          )}

          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-card rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: acc.color + '22', border: `1px solid ${acc.color}44` }}
                  >
                    {ACCOUNT_TYPES.find(t => t.value === acc.type)?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.institution}
                      {acc.last_four && ` •••• ${acc.last_four}`}
                      {' · '}{acc.type.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(acc.balance)}</p>
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      className="text-xs text-destructive/70 hover:text-destructive"
                    >
                      Remove
                    </button>
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
                  <button
                    key={t.value}
                    onClick={() => setNewAcct(p => ({ ...p, type: t.value }))}
                    className={cn(
                      'p-3 rounded-xl border text-center transition-all',
                      newAcct.type === t.value ? 'border-violet-500 bg-violet-500/10' : 'border-border hover:bg-muted'
                    )}
                  >
                    <div className="text-xl mb-1">{t.icon}</div>
                    <p className="text-xs font-medium">{t.label}</p>
                  </button>
                ))}
              </div>

              <input
                placeholder="Account name (e.g. BMO Chequing)"
                value={newAcct.name}
                onChange={e => setNewAcct(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <input
                placeholder="Institution (e.g. BMO)"
                value={newAcct.institution}
                onChange={e => setNewAcct(p => ({ ...p, institution: e.target.value }))}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <input
                placeholder="Last 4 digits (optional)"
                value={newAcct.last_four}
                onChange={e => setNewAcct(p => ({ ...p, last_four: e.target.value }))}
                maxLength={4}
                className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              {newAcct.type === 'credit_card' && (
                <input
                  placeholder="Credit limit (optional)"
                  type="number"
                  value={newAcct.credit_limit}
                  onChange={e => setNewAcct(p => ({ ...p, credit_limit: e.target.value }))}
                  className="w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Colour</p>
                <div className="flex gap-2">
                  {ACCOUNT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewAcct(p => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: newAcct.color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: '2px'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addAccount}
                  disabled={saving}
                  className="flex-1 bg-violet-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Account'}
                </button>
                <button
                  onClick={() => setAddingAccount(false)}
                  className="flex-1 bg-muted text-muted-foreground rounded-xl py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingAccount(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-violet-500/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Add Account</span>
            </button>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="bg-card rounded-2xl border overflow-hidden">
          {categories.map((cat, i) => (
            <div key={cat.id} className={cn('flex items-center gap-3 px-4 py-3', i !== categories.length - 1 && 'border-b')}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: cat.color + '22' }}
              >
                {cat.icon}
              </div>
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
            </div>
          ))}
        </div>
      )}

      {/* Rules Tab */}
      {tab === 'rules' && <MerchantRules />}

      <div className="pt-4 pb-2 text-center space-y-1">
        <p className="text-xs text-muted-foreground">Ledger — Personal Budget</p>
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </div>
  )
}

function MerchantRules() {
  const [rules, setRules] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('merchant_rules')
      .select('*, category:categories(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRules(data || []))
  }, [])

  async function deleteRule(id: string) {
    await supabase.from('merchant_rules').delete().eq('id', id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Rules are created automatically when you recategorize transactions.
      </p>
      <div className="bg-card rounded-2xl border overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No rules yet. Edit a transaction's category to create one.
          </div>
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
