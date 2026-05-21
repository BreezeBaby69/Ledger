import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isTransferLike } from '@/lib/utils'

// Try models in order until one works
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
]

async function callGemini(apiKey: string, parts: any[], model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  })
  return res
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const accountId = formData.get('account_id') as string

    if (!file || !accountId) {
      return NextResponse.json({ error: 'Missing file or account_id' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const supabase = createAdminClient()
    const [{ data: rules }, { data: categories }] = await Promise.all([
      supabase.from('merchant_rules').select('*, category:categories(*)'),
      supabase.from('categories').select('id, name, icon').order('name'),
    ])

    const categoryList = (categories || []).map((c: any) => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `You are a financial statement parser for Canadian bank and credit card statements.
Extract ALL transactions from this statement image or PDF.

Return ONLY a valid JSON array with no other text, markdown, or explanation.

Each transaction object must have exactly these fields:
- date: string "YYYY-MM-DD"
- merchant: string (clean name, e.g. "COSTCO WHSE #0152 EDMONTON AB" becomes "Costco")
- amount: number (NEGATIVE for debits/purchases, POSITIVE for credits/deposits/refunds)
- suggested_category_id: string or null (use one of the IDs below)
- is_transfer: boolean (true for payments, e-transfers, "PAYMENT THANK YOU", etc.)
- confidence: number 0-1

Available category IDs:
${categoryList}

Rules:
- Extract every single transaction, do not skip any
- Credit card payments and bank transfers: is_transfer true, suggested_category_id null
- Refunds and credits that are NOT transfers: positive amount
- Skip opening/closing balances and summary totals
- Make your best guess if unclear, set confidence low

Respond with ONLY the JSON array, nothing else.`

    const parts: any[] = [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: base64 } }
    ]

    // Try each model until one works
    let geminiRes: Response | null = null
    let workingModel = ''
    for (const model of GEMINI_MODELS) {
      const res = await callGemini(apiKey, parts, model)
      if (res.ok) {
        geminiRes = res
        workingModel = model
        break
      }
      const errData = await res.json()
      console.log(`Model ${model} failed:`, errData?.error?.message)
    }

    if (!geminiRes) {
      return NextResponse.json(
        { error: 'All Gemini models failed. Check your API key is valid and has access.' },
        { status: 500 }
      )
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

    let extracted: any[] = []
    try {
      const clean = rawText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(clean)
      if (!Array.isArray(extracted)) extracted = []
    } catch {
      console.error('Failed to parse Gemini response:', rawText)
      return NextResponse.json({ error: 'AI returned unreadable data. Try a clearer image.' }, { status: 500 })
    }

    const ruleMap = new Map((rules || []).map((r: any) => [r.merchant_pattern.toLowerCase(), r]))

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      let categoryId = t.suggested_category_id || null

      for (const [pattern, rule] of Array.from(ruleMap)) {
        if (merchantLower.includes(pattern as string)) {
          categoryId = (rule as any).category_id
          break
        }
      }

      return {
        id: crypto.randomUUID(),
        date: t.date,
        merchant: t.merchant || 'Unknown',
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0,
        suggested_category_id: categoryId,
        is_transfer_candidate: t.is_transfer || isTransferLike(t.merchant || ''),
        is_duplicate_candidate: false,
        status: 'pending',
        confidence: t.confidence ?? 0.8,
      }
    })

    transactions.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ transactions, count: transactions.length, model: workingModel })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}
