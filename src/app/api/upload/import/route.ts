import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Accept both camelCase and snake_case field names
    const transactions = body.transactions
    const accountId = body.accountId || body.account_id

    if (!transactions?.length || !accountId) {
      return NextResponse.json({ 
        error: 'Missing transactions or accountId',
        received: Object.keys(body)
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    const batchId = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = transactions.map((t: any) => ({
      account_id: accountId,
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      category_id: t.suggested_category_id || t.category_id || null,
      is_transfer: t.is_transfer_candidate || t.is_transfer || false,
      is_recurring: false,
      import_batch_id: batchId,
      created_at: now,
      updated_at: now,
    }))

    const { error } = await supabase.from('transactions').insert(rows)

    if (error) {
      return NextResponse.json({ 
        error: 'Database error: ' + error.message, 
        code: error.code, 
        details: error.details 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length, batch_id: batchId })

  } catch (err: any) {
    console.error('Import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
