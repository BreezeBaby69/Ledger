import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isTransferLike } from '@/lib/utils'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

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

    // Convert to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Get merchant rules + categories from Supabase
    const supabase = createAdminClient()
    const [{ data: rules }, { data: categories }] = await Promise.all([
      supabase.from('merchant_rules').select('*, category:categories(*)'),
      supabase.from('categories').select('id, name, icon').order('name'),
    ])

    const categoryList = (categories || []).map(c => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `You are a financial statement parser for Canadian bank and credit card statements.
Extract ALL transactions from this statement image or PDF.

Return ONLY a valid JSON array with no other text, markdown, or explanation.

Each transaction object must have exactly these fields:
- date: string "YYYY-MM-DD"
- merchant: string (clean name, e.g. "COSTCO WHSE #0152 EDMONTON AB" → "Costco")
- amount: number (NEGATIVE for debits/purchases, POSITIVE for credits/deposits/refunds)
- suggested_category_id: string or null (use one of the IDs below)
- is_transfer: boolean (true for payments, e-transfers, "PAYMENT THANK YOU", etc.)
- confidence: number 0-1

Available category IDs:
${categoryList}

Rules:
- Extract every single transaction — do not skip any
- Credit card payments and bank transfers → is_transfer: true, suggested_category_id: null
- Refunds and credits that are NOT transfers → positive amount
- Opening/closing balances, totals, fees summaries → skip these, only extract transactions
- If you cannot read a value clearly, make your best guess and set confidence low

Respond with ONLY the JSON array, nothing else.`

    // Build Gemini request parts
    const parts: any[] = [{ text: prompt }]

    if (mimeType === 'application/pdf') {
      // Gemini supports PDF as inline data
      parts.push({
        inline_data: { mime_type: 'application/pdf', data: base64 }
      })
    } else {
      parts.push({
        inline_data: { mime_type: mimeType, data: base64 }
      })
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!geminiRes.ok) {
      const err = await geminiRes.json()
      console.error('Gemini error:', err)
      return NextResponse.json(
        { error: err?.error?.message || 'Gemini API error' },
        { status: 500 }
      )
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

    // Parse — strip any accidental markdown fences
    let extracted: any[] = []
    try {
      const clean = rawText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
      extracted = JSON.parse(clean)
      if (!Array.isArray(extracted)) extracted = []
    } catch {
      console.error('Failed to parse Gemini response:', rawText)
      return NextResponse.json({ error: 'AI returned unreadable data. Try a clearer image.' }, { status: 500 })
    }

    // Apply saved merchant rules on top of AI suggestions
    const ruleMap = new Map((rules || []).map(r => [r.merchant_pattern.toLowerCase(), r]))

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      let categoryId = t.suggested_category_id || null

      for (const [pattern, rule] of Array.from(ruleMap)) {
        if (merchantLower.includes(pattern)) {
          categoryId = rule.category_id
          break
        }
      }

      const isTransfer = t.is_transfer || isTransferLike(t.merchant || '')

      return {
        id: crypto.randomUUID(),
        date: t.date,
        merchant: t.merchant || 'Unknown',
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0,
        suggested_category_id: categoryId,
        is_transfer_candidate: isTransfer,
        is_duplicate_candidate: false,
        status: 'pending',
        confidence: t.confidence ?? 0.8,
      }
    })

    // Sort newest first
    transactions.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ transactions, count: transactions.length })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}
