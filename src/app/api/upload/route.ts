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
      supabase.from('categories').select('id, name, icon, type').order('name'),
      supabase.from('transactions').select('date, merchant, amount').eq('account_id', accountId),
    ])

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
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 }
      }),
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      return NextResponse.json({ error: `Gemini error: ${geminiData?.error?.message || 'Unknown'}` }, { status: 500 })
    }

    const rawText = (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    if (!rawText) return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 })

    const firstBracket = rawText.indexOf('[')
    const lastBracket = rawText.lastIndexOf(']')
    if (firstBracket === -1 || lastBracket === -1) {
      return NextResponse.json({ error: `No JSON array in response: ${rawText.substring(0, 200)}` }, { status: 500 })
    }

    let extracted: any[] = []
    try {
      extracted = JSON.parse(rawText.substring(firstBracket, lastBracket + 1))
      if (!Array.isArray(extracted)) extracted = []
    } catch (e: any) {
      return NextResponse.json({ error: `Parse error: ${e.message}` }, { status: 500 })
    }

    // Build lookup maps
    const existingSet = new Set((existing || []).map((t: any) => `${t.date}|${t.merchant}|${t.amount}`))

    // Category lookups by name
    const catByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c.id]))

    // Rule maps
    const exactRules = new Map<string, string>()
    const merchantRules = new Map<string, string>()
    for (const rule of rules || []) {
      if (rule.match_type === 'exact' && rule.merchant_pattern.includes('|')) {
        exactRules.set(rule.merchant_pattern.toLowerCase(), rule.category_id)
      } else {
        merchantRules.set(rule.merchant_pattern.toLowerCase(), rule.category_id)
      }
    }

    const transactions = extracted.map((t: any) => {
      const merchantLower = (t.merchant || '').toLowerCase()
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0
      let categoryId: string | null = null

      // 1. Exact merchant+amount rule (highest priority)
      const exactKey = `${merchantLower}|${amount}`
      if (exactRules.has(exactKey)) categoryId = exactRules.get(exactKey)!

      // 2. Merchant-only rules
      if (!categoryId) {
        for (const [pattern, catId] of Array.from(merchantRules)) {
          if (merchantLower.includes(pattern)) { categoryId = catId; break }
        }
      }

      // 3. Built-in auto-categorization
      if (!categoryId) {
        if (amount > 0) {
          // INCOME categorization
          if (/edmonton elks|cfl|football|hockey|nhl|nba|mlb|nfl|sports team|athlete|player/i.test(merchantLower)) {
            categoryId = catByName.get('employment') || null
          } else if (/government|alberta|canada|cra|employment insurance|ei payment|cpp|oas|cerb|aish|alberta works/i.test(merchantLower)) {
            categoryId = catByName.get('government') || null
          } else if (/payroll|salary|wages|direct deposit|employer|corp|inc\.|ltd\.|llc/i.test(merchantLower)) {
            categoryId = catByName.get('employment') || null
          } else if (/etransfer|e-transfer received|interac.*received/i.test(merchantLower)) {
            categoryId = catByName.get('other income') || null
          } else if (/dividend|interest|investment|returns|capital gain/i.test(merchantLower)) {
            categoryId = catByName.get('investment') || null
          } else if (/freelance|contract|invoice|consulting|client/i.test(merchantLower)) {
            categoryId = catByName.get('side hustle') || null
          } else {
            categoryId = catByName.get('other income') || null
          }
        } else {
          // EXPENSE categorization
          if (/costco|walmart|safeway|superstore|sobeys|loblaws|iga|freshco|no frills/i.test(merchantLower)) {
            categoryId = catByName.get('groceries') || null
          } else if (/tim horton|mcdonald|starbucks|subway|a&w|burger|pizza|restaurant|cafe|sushi|chipotle|earls|boston pizza/i.test(merchantLower)) {
            categoryId = catByName.get('restaurants') || null
          } else if (/shell|esso|petro|husky|pioneer|costco gas|canco/i.test(merchantLower)) {
            categoryId = catByName.get('gas') || null
          } else if (/netflix|spotify|amazon prime|disney|crave|apple\.com|google play/i.test(merchantLower)) {
            categoryId = catByName.get('subscriptions') || null
          } else if (/atco|enmax|telus|shaw|rogers|bell|epcor/i.test(merchantLower)) {
            categoryId = catByName.get('utilities') || null
          } else if (/best buy|amazon|ikea|home depot|canadian tire|sport chek|old navy|winners/i.test(merchantLower)) {
            categoryId = catByName.get('shopping') || null
          } else if (/cineplex|ticketmaster|landmark|bowling|golf/i.test(merchantLower)) {
            categoryId = catByName.get('entertainment') || null
          } else if (/atb|mortgage|rent|loan|insurance|lns/i.test(merchantLower)) {
            categoryId = catByName.get('housing') || null
          } else if (/credit card|payment|visa|mastercard|amex/i.test(merchantLower)) {
            categoryId = catByName.get('credit card payments') || null
          } else if (/transfer|e-transfer sent/i.test(merchantLower)) {
            categoryId = catByName.get('transfers') || null
          }
        }
      }

      // Auto-flag credit card payments and transfers as transfers
      const isCreditCardPayment = /credit card|payment.*visa|payment.*mastercard|payment.*amex/i.test(merchantLower)
      const isTransferOut = amount < 0 && /^transfer|e-transfer sent/i.test(merchantLower)
      const isAutoTransfer = isCreditCardPayment || isTransferOut

      const isDuplicate = existingSet.has(`${t.date}|${t.merchant}|${amount}`)

      return {
        id: crypto.randomUUID(),
        date: t.date || new Date().toISOString().split('T')[0],
        merchant: t.merchant || 'Unknown',
        amount,
        suggested_category_id: categoryId,
        is_transfer_candidate: isAutoTransfer,
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
