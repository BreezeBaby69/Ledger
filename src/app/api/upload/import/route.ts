import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { transactions, account_id } = await req.json()

    if (!transactions?.length || !account_id) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check for duplicates in existing transactions
    const { data: existing } = await supabase
      .from('transactions')
      .select('date, merchant, amount, account_id')
      .eq('account_id', account_id)
      .in('date', transactions.map((t: any) => t.date))

    const existingSet = new Set(
      (existing || []).map((t: any) => `${t.date}|${t.merchant}|${t.amount}`)
    )

    // Create batch
    const batchId = crypto.randomUUID()
    const toInsert = transactions
      .filter((t: any) => !existingSet.has(`${t.date}|${t.merchant}|${t.amount}`))
      .map((t: any) => ({
        account_id,
        date: t.date,
        merchant: t.merchant,
        amount: t.amount,
        category_id: t.suggested_category_id || null,
        is_transfer: t.is_transfer_candidate || false,
        is_recurring: false,
        import_batch_id: batchId,
      }))

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped: transactions.length, message: 'All duplicates skipped' })
    }

    const { error } = await supabase.from('transactions').insert(toInsert)
    if (error) throw error

    // Update account balance (simple: recalculate from transactions)
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('amount')
      .eq('account_id', account_id)

    // For checking/savings: sum all. For credit: sum of charges
    const { data: account } = await supabase
      .from('accounts')
      .select('type')
      .eq('id', account_id)
      .single()

    if (account) {
      const total = (allTxns || []).reduce((s: number, t: any) => s + t.amount, 0)
      const balance = account.type === 'credit_card'
        ? Math.abs(Math.min(0, total)) // amount owed
        : total
      await supabase.from('accounts').update({ balance, updated_at: new Date().toISOString() }).eq('id', account_id)
    }

    // Detect recurring transactions
    await detectRecurring(account_id, supabase)

    return NextResponse.json({
      imported: toInsert.length,
      skipped: transactions.length - toInsert.length,
      batch_id: batchId,
    })

  } catch (err: any) {
    console.error('Import error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function detectRecurring(accountId: string, supabase: any) {
  const { data: txns } = await supabase
    .from('transactions')
    .select('merchant, amount, date')
    .eq('account_id', accountId)
    .lt('amount', 0)
    .order('date', { ascending: false })
    .limit(200)

  if (!txns) return

  // Group by merchant+amount
  const groups: Record<string, { dates: string[] }> = {}
  for (const t of txns) {
    const key = `${t.merchant}|${Math.abs(t.amount)}`
    if (!groups[key]) groups[key] = { dates: [] }
    groups[key].dates.push(t.date)
  }

  for (const [key, { dates }] of Object.entries(groups)) {
    if (dates.length >= 2) {
      const [merchant] = key.split('|')
      await supabase.from('transactions')
        .update({ is_recurring: true })
        .eq('account_id', accountId)
        .ilike('merchant', `%${merchant}%`)
    }
  }
}
