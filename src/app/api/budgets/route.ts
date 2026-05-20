import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 })

  const supabase = createAdminClient()
  const [year, mon] = month.split('-')
  const start = `${month}-01`
  const end = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0]

  const [{ data: budgets }, { data: txns }] = await Promise.all([
    supabase.from('budgets').select('*, category:categories(*)').eq('month', month),
    supabase.from('transactions').select('category_id, amount')
      .gte('date', start).lte('date', end).eq('is_transfer', false).lt('amount', 0),
  ])

  const spentMap: Record<string, number> = {}
  for (const t of txns || []) {
    if (t.category_id) spentMap[t.category_id] = (spentMap[t.category_id] || 0) + Math.abs(t.amount)
  }

  const result = (budgets || []).map(b => ({ ...b, spent: spentMap[b.category_id] || 0 }))
  return NextResponse.json({ budgets: result })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('budgets').upsert(body, { onConflict: 'category_id,month' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ budget: data })
}

export async function PATCH(req: NextRequest) {
  const { id, amount } = await req.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('budgets').update({ amount }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ budget: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
