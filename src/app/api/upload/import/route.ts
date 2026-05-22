import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transactions, account_id } = body

    if (!transactions?.length || !account_id) {
      return NextResponse.json({ error: 'Missing transactions or account_id' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify account exists
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('id, type')
      .eq('id', account_id)
      .single()

    if (accErr || !account) {
      return NextResponse.json({ error: `Account not found: ${accErr?.message}` }, { status: 400 })
    }

    // Build insert payload - only include valid fields
    const toInsert = transactions.map((t: any) => ({
      account_id,
      date: t.date,
      merchant: t.merchant || 'Unknown',
      amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0,
      category_id: t.suggested_category_id || null,
      is_transfer: t.is_transfer_candidate || false,
      is_recurring: false,
      notes: null,
    }))

    // Insert in batches of 20 to avoid issues
    const batchSize = 20
    let totalInserted = 0

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('transactions')
        .insert(batch)
        .select('id')

      if (error) {
        console.error('Batch insert error:', error)
        return NextResponse.json({
          error: `Database error: ${error.message}`,
          code: error.code,
          details: error.details,
        }, { status: 500 })
      }

      totalInserted += (data?.length || 0)
    }

    // Update account balance
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('amount')
      .eq('account_id', account_id)

    const total = (allTxns || []).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    const balance = account.type === 'credit_card'
      ? Math.abs(Math.min(0, total))
      : Math.max(0, total)

    await supabase
      .from('accounts')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', account_id)

    return NextResponse.json({ imported: totalInserted, total: transactions.length })

  } catch (err: any) {
    console.error('Import error:', err)
    return NextResponse.json({
      error: err.message || 'Import failed',
      stack: err.stack?.substring(0, 500)
    }, { status: 500 })
  }
}
