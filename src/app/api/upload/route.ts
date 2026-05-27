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
      // Load existing transactions for duplicate detection
      supabase.from('transactions').select('date, merchant, amount').eq('account_id', accountId),
    ])

    const categoryList = (categories || []).map((c: any) => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `Extract all transactions from this Canadian bank or credit card statement.

Return a JSON array. Each item has:
- date: "YYYY-MM-DD"
- merchant: clean name (e.g. "INTERAC e-Transfer Received", "Government of Alberta MSP", "Tim Hortons")
- amount: negative for purchases/debits, positive for deposits/credits
- confidence: 0.9

Do NOT set any transfer flags — just extract the raw transactions exactly as they appear.

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
      return NextResponse.json(
        { error: `No JSON array in response: ${rawText.substring(0, 200)}` },
        { status: 500 }
      )
    }

    let extracted: any[] = []
    try {
      extracted = JSON.parse(rawText.substring(firstBracket, lastBracket + 1))
      if (!Array.isArray(extracted)) extracted = []
    } catch (e: any) {
      return NextResponse.json(
        { error: `Parse error: ${e.message}` },
        { status: 500 }
      )
    }

    // Build duplicate set from existing transactions
    const existingSet = new Set(
      (existing || []).map((t: any) => `${t.date}|${t.merchant}|${t.amount}`)
    )

    // Build category lookup by name
    const catByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c.id]))

    // Apply merchant rules
    const ruleMap = new Map((rules || []).map((r: any) => [r.merchant_pattern.toLowerCase(), r]))

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      let categoryId: string | null = null

      // Apply saved merchant rules first
      for (const [pattern, rule] of Array.from(ruleMap)) {
        if (merchantLower.includes(pattern as string)) {
          categoryId = (rule as any).category_id
          break
        }
      }

      // Auto-categorize by merchant name if no rule matched
      if (!categoryId) {
        if (/costco|walmart|safeway|superstore|sobeys|loblaws|iga|freshco|no frills/i.test(merchantLower)) {
          categoryId = catByName.get('groceries') || null
        } else if (/tim horton|mcdonald|starbucks|subway|a&w|burger|pizza|restaurant|cafe|sushi|chipotle|firehouse|italian centre|earls|boston pizza/i.test(merchantLower)) {
          categoryId = catByName.get('restaurants') || null
        } else if (/shell|esso|petro|husky|pioneer|costco gas|hughes/i.test(merchantLower)) {
          categoryId = catByName.get('gas') || null
        } else if (/netflix|spotify|amazon prime|disney|crave|apple\.com|google play|crunchyroll/i.test(merchantLower)) {
          categoryId = catByName.get('subscriptions') || null
        } else if (/atco|enmax|telus|shaw|rogers|bell|epcor/i.test(merchantLower)) {
          categoryId = catByName.get('utilities') || null
        } else if (/best buy|amazon|ikea|home depot|canadian tire|sport chek|old navy|winners|chapters/i.test(merchantLower)) {
          categoryId = catByName.get('shopping') || null
        } else if (/cineplex|ticketmaster|live bowl|golf|landmark/i.test(merchantLower)) {
          categoryId = catByName.get('entertainment') || null
        } else if (/crunch|goodlife|equinox|ymca/i.test(merchantLower)) {
          categoryId = catByName.get('subscriptions') || null
        } else if (/government|alberta|canada|cra|employment insurance|ei payment/i.test(merchantLower)) {
          categoryId = catByName.get('income') || null
        } else if (t.amount > 0 && /interac|e-transfer received|deposit/i.test(merchantLower)) {
          categoryId = catByName.get('income') || null
        }
      }

      // Only flag as duplicate if exact match exists in database
      const key = `${t.date}|${t.merchant}|${t.amount}`
      const isDuplicate = existingSet.has(key)

      return {
        id: crypto.randomUUID(),
        date: t.date || new Date().toISOString().split('T')[0],
        merchant: t.merchant || 'Unknown',
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0,
        suggested_category_id: categoryId,
        is_transfer_candidate: false,      // Never auto-flag as transfer
        is_duplicate_candidate: isDuplicate, // Only flag real duplicates
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
