import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const GEMINI_MODEL = 'gemini-2.5-flash'

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
    const [{ data: rules }, { data: categories }, { data: existing }] = await Promise.all([
      supabase.from('merchant_rules').select('*, category:categories(*)'),
      supabase.from('categories').select('id, name, icon').order('name'),
      supabase.from('transactions').select('date, merchant, amount').eq('account_id', accountId),
    ])

    const categoryList = (categories || []).map((c: any) => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `Extract all transactions from this Canadian bank or credit card statement.

Return a JSON array. Each item has:
- date: "YYYY-MM-DD"
- merchant: clean name (e.g. "INTERAC e-Transfer Received", "Government of Alberta", "Tim Hortons")
- amount: negative for purchases/debits, positive for deposits/credits
- confidence: 0.9

Return ONLY the raw JSON array starting with [ and ending with ].`

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
        generationConfig: { temperature: 0, maxOutputTokens: 65536 }
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
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 })
    }

    const firstBracket = rawText.indexOf('[')
    const lastBracket = rawText.lastIndexOf(']')

    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
      return NextResponse.json({ error: `No JSON array in response: ${rawText.substring(0, 200)}` }, { status: 500 })
    }

    let extracted: any[] = []
    try {
      extracted = JSON.parse(rawText.substring(firstBracket, lastBracket + 1))
      if (!Array.isArray(extracted)) extracted = []
    } catch (e: any) {
      return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 500 })
    }

    // Build duplicate set
    const existingSet = new Set(
      (existing || []).map((t: any) => `${t.date}|${t.merchant}|${t.amount}`)
    )

    // Build rule maps:
    // 1. Exact merchant+amount rules (from import review corrections) — highest priority
    // 2. Merchant-only rules (from post-import edits)
    const exactRules = new Map<string, string>() // "merchant|amount" -> category_id
    const merchantRules = new Map<string, string>() // "merchant pattern" -> category_id

    for (const rule of rules || []) {
      if (rule.match_type === 'exact' && rule.merchant_pattern.includes('|')) {
        exactRules.set(rule.merchant_pattern.toLowerCase(), rule.category_id)
      } else if (rule.match_type === 'contains') {
        merchantRules.set(rule.merchant_pattern.toLowerCase(), rule.category_id)
      } else if (rule.match_type === 'exact') {
        merchantRules.set(rule.merchant_pattern.toLowerCase(), rule.category_id)
      }
    }

    // Category name lookup
    const catByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c.id]))

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0
      let categoryId: string | null = null

      // 1. Check exact merchant+amount rule first (highest priority — user taught this)
      const exactKey = `${merchantLower}|${amount}`
      if (exactRules.has(exactKey)) {
        categoryId = exactRules.get(exactKey)!
      }

      // 2. Check merchant-only rules
      if (!categoryId) {
        for (const [pattern, catId] of Array.from(merchantRules)) {
          if (merchantLower.includes(pattern)) {
            categoryId = catId
            break
          }
        }
      }

      // 3. Built-in auto-categorization as fallback
      if (!categoryId) {
        if (/costco|walmart|safeway|superstore|sobeys|loblaws|iga|freshco|no frills/i.test(merchantLower)) {
          categoryId = catByName.get('groceries') || null
        } else if (/tim horton|mcdonald|starbucks|subway|a&w|burger|pizza|restaurant|cafe|sushi|chipotle|firehouse|italian centre|earls|boston pizza/i.test(merchantLower)) {
          categoryId = catByName.get('restaurants') || null
        } else if (/shell|esso|petro|husky|pioneer|costco gas|hughes/i.test(merchantLower)) {
          categoryId = catByName.get('gas') || null
        } else if (/netflix|spotify|amazon prime|disney|crave|apple\.com|google play/i.test(merchantLower)) {
          categoryId = catByName.get('subscriptions') || null
        } else if (/atco|enmax|telus|shaw|rogers|bell|epcor/i.test(merchantLower)) {
          categoryId = catByName.get('utilities') || null
        } else if (/best buy|amazon|ikea|home depot|canadian tire|sport chek|old navy|winners|chapters/i.test(merchantLower)) {
          categoryId = catByName.get('shopping') || null
        } else if (/cineplex|ticketmaster|live bowl|golf|landmark/i.test(merchantLower)) {
          categoryId = catByName.get('entertainment') || null
        } else if (/crunch|goodlife|equinox|ymca/i.test(merchantLower)) {
          categoryId = catByName.get('subscriptions') || null
        } else if (/government|alberta|canada|cra|employment insurance/i.test(merchantLower)) {
          categoryId = catByName.get('income') || null
        } else if (amount > 0 && /interac|e-transfer received|deposit/i.test(merchantLower)) {
          categoryId = catByName.get('income') || null
        }
      }

      const isDuplicate = existingSet.has(`${t.date}|${t.merchant}|${amount}`)

      return {
        id: crypto.randomUUID(),
        date: t.date || new Date().toISOString().split('T')[0],
        merchant: t.merchant || 'Unknown',
        amount,
        suggested_category_id: categoryId,
        is_transfer_candidate: false,
        is_duplicate_candidate: isDuplicate,
        status: isDuplicate ? 'pending' : 'approved',
        confidence: t.confidence ?? 0.9,
      }
    })

    transactions.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ transactions, count: transactions.length })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}
