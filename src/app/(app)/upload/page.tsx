'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import ImportReview from '@/components/upload/ImportReview'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'review' | 'importing' | 'done' | 'error'

interface UploadedFile {
  file: File
  preview?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
}

export default function UploadPage() {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [pendingTxns, setPendingTxns] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const loadAccounts = useCallback(async () => {
    const { data } = await supabase.from('accounts').select('*').order('name')
    setAccounts(data || [])
  }, [])

  useState(() => { loadAccounts() })

  function handleFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming)
    const valid = arr.filter(f => {
      const ext = f.name.toLowerCase()
      return ext.endsWith('.pdf') || ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')
    })

    const newFiles: UploadedFile[] = valid.map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      status: 'pending',
    }))

    setFiles(prev => [...prev, ...newFiles])
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleProcess() {
    if (!files.length || !selectedAccount) return
    setStatus('processing')
    setError('')

    try {
      const allPending: any[] = []

      for (let i = 0; i < files.length; i++) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f))

        const formData = new FormData()
        formData.append('file', files[i].file)
        formData.append('account_id', selectedAccount)

        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Processing failed')

        allPending.push(...(data.transactions || []))
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f))
      }

      setPendingTxns(allPending)
      setStatus('review')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  async function handleImport(approved: any[]) {
    setStatus('importing')
    try {
      const res = await fetch('/api/upload/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: approved, account_id: selectedAccount }),
      })
      if (!res.ok) throw new Error('Import failed')
      setStatus('done')
    } catch (err: any) {
      setError(err.message)
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setFiles([])
    setPendingTxns([])
    setError('')
  }

  // Review screen
  if (status === 'review') {
    return (
      <ImportReview
        transactions={pendingTxns}
        accountId={selectedAccount}
        onImport={handleImport}
        onCancel={reset}
      />
    )
  }

  // Done screen
  if (status === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 page-transition">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold">Import Complete!</h2>
        <p className="text-muted-foreground text-sm text-center">
          Transactions have been added to your budget.
        </p>
        <button
          onClick={reset}
          className="mt-4 bg-violet-500 text-white rounded-2xl px-6 py-3 text-sm font-semibold"
        >
          Import More
        </button>
        <a href="/transactions" className="text-violet-400 text-sm">View Transactions</a>
      </div>
    )
  }

  return (
    <div className="space-y-5 page-transition">
      {/* Account selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Which account is this statement for?
        </label>
        <div className="space-y-2">
          {accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccount(acc.id)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all',
                selectedAccount === acc.id
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-border bg-card hover:bg-muted/50'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold',
                selectedAccount === acc.id ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {acc.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{acc.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')} · {acc.institution}</p>
              </div>
              {selectedAccount === acc.id && (
                <CheckCircle size={18} className="text-violet-400" />
              )}
            </button>
          ))}
          {accounts.length === 0 && (
            <div className="p-4 rounded-2xl border border-dashed text-center">
              <p className="text-sm text-muted-foreground">
                No accounts yet. <a href="/settings" className="text-violet-400">Add one in Settings.</a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Upload Statements
        </label>
        <label
          className={cn(
            'relative block rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
            dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-border hover:border-violet-500/50 hover:bg-muted/30'
          )}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
          <Upload size={28} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Drop files here or tap to browse</p>
          <p className="text-xs text-muted-foreground">PDF, PNG, JPG supported · Multiple files OK</p>
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-card border rounded-xl p-3">
              {f.preview ? (
                <img src={f.preview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(f.file.size / 1024 / 1024).toFixed(1)} MB
                  {f.status === 'processing' && ' · Processing...'}
                  {f.status === 'done' && ' · Done ✓'}
                  {f.status === 'error' && ` · Error: ${f.error}`}
                </p>
              </div>
              {f.status === 'pending' && (
                <button onClick={() => removeFile(i)} className="p-1 hover:bg-muted rounded-lg">
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
              {f.status === 'processing' && <Loader2 size={16} className="text-violet-400 animate-spin" />}
              {f.status === 'done' && <CheckCircle size={16} className="text-emerald-400" />}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
          <AlertCircle size={16} className="text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Process button */}
      <button
        onClick={handleProcess}
        disabled={!files.length || !selectedAccount || status === 'processing'}
        className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white rounded-2xl py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {status === 'processing' ? (
          <><Loader2 size={16} className="animate-spin" /> Analyzing with AI...</>
        ) : (
          <>Extract Transactions <ChevronRight size={16} /></>
        )}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        AI will detect and categorize transactions automatically.<br />
        You'll review everything before importing.
      </p>
    </div>
  )
}
