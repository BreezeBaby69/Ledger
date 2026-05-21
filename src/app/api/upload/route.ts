import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isTransferLike } from '@/lib/utils'

const GEMINI_MODEL = 'gemini-2.5-flash'

function extractJSON(text: string): any[] | null {
  // Strip markdown fences
  let s = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  
  // Try direct parse first
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return parsed
    // Maybe it's {transactions: [...]} or similar
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val)) return val as any[]
    }
  } catch {}

  // Find outermost [ ... ] by counting brackets
  let depth = 0
  let start = -1
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '[') {
      if (depth === 0) start = i
      depth++
    } else if (s[i] === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(s.substring(start, i + 1))
          if (Array.isArray(parsed)) return parsed
        } catch {}
      }
    }
  }
  return null
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
    const mimeType = file.type || 'application/pdf'

    const supabase = createAdminClient()
    const [{ data: rules }, { data: categories }] = await Promise.all([
      supabase.from('merchant_rules').select('*, category:categories(*)'),
      supabase.from('categories').select('id, name, icon').order('name'),
    ])

    const categoryList = (categories || []).map((c: any) => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `Extract all transactions from this Canadian bank or credit card statement.

Return a JSON array of transaction objects with these fields:
- date: "YYYY-MM-DD"
- merchant: clean merchant name
- amount: negative number for purchases, positive for payments/refunds
- suggested_category_id: null (always use null, do not guess)
- is_transfer: true for payments/transfers, false otherwise
- confidence: 0.9

Rules:
- PAYMENT THANK YOU = is_transfer true, positive amount
- Regular purchases = negative amounts
- Extract every single transaction

Return only the raw JSON array starting with [ and ending with ].`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 }
      }),
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      return NextResponse.json(
        { error: `Gemini error: ${geminiData?.error?.message || 'Unknown'}` },
        { status: 500 }
      )
    }

    const rawText = (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()

    if (!rawText) {
      return NextResponse.json({ error: 'Gemini returned empty response.' }, { status: 500 })
    }

    const extracted = extractJSON(rawText)

    if (!extracted || extracted.length === 0) {
      return NextResponse.json(
        { error: `Could not parse AI response: ${rawText.substring(0, 200)}` },
        { status: 500 }
      )
    }

    // Apply merchant rules and categorize
    const ruleMap = new Map((rules || []).map((r: any) => [r.merchant_pattern.toLowerCase(), r]))

    // Get category IDs by name for fallback categorization
    const catByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c.id]))

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      let categoryId: string | null = null

      // Apply saved rules first
      for (const [pattern, rule] of Array.from(ruleMap)) {
        if (merchantLower.includes(pattern as string)) {
          categoryId = (rule as any).category_id
          break
        }
      }

      // Auto-categorize common merchants if no rule matched
      if (!categoryId) {
        if (/costco|walmart|safeway|superstore|sobeys|iga|loblaws/i.test(t.merchant)) {
          categoryId = catByName.get('groceries') || null
        } else if (/tim hortons|mcdonald|starbucks|subway|a&w|burger|pizza|restaurant|cafe|sushi|chipotle/i.test(t.merchant)) {
          categoryId = catByName.get('restaurants') || null
        } else if (/shell|esso|petro|husky|pioneer|gas/i.test(t.merchant)) {
          categoryId = catByName.get('gas') || null
        } else if (/netflix|spotify|amazon prime|disney|crave|apple|google play/i.test(t.merchant)) {
          categoryId = catByName.get('subscriptions') || null
        } else if (/atco|enmax|telus|shaw|rogers|bell|utilities/i.test(t.merchant)) {
          categoryId = catByName.get('utilities') || null
        }
      }

      return {
        id: crypto.randomUUID(),
        date: t.date,
        merchant: t.merchant || 'Unknown',
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0,
        suggested_category_id: categoryId,
        is_transfer_candidate: t.is_transfer || isTransferLike(t.merchant || ''),
        is_duplicate_candidate: false,
        status: 'pending',
        confidence: 0.9,
      }
    })

    transactions.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ transactions, count: transactions.length })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}
