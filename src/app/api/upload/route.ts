import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isTransferLike } from '@/lib/utils'

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
    const [{ data: rules }, { data: categories }] = await Promise.all([
      supabase.from('merchant_rules').select('*, category:categories(*)'),
      supabase.from('categories').select('id, name, icon').order('name'),
    ])

    const categoryList = (categories || []).map((c: any) => `${c.id}: ${c.icon} ${c.name}`).join('\n')

    const prompt = `You are a financial statement parser for Canadian bank and credit card statements.
Extract ALL transactions from this statement.

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Just the raw JSON array.

Each object must have:
- date: "YYYY-MM-DD"
- merchant: clean merchant name (e.g. "COSTCO WHOLESALE W1112 EDMONTON AB" becomes "Costco")
- amount: number, NEGATIVE for purchases/charges, POSITIVE for payments/credits/refunds
- suggested_category_id: one of the IDs below, or null
- is_transfer: true if it's a payment or transfer, false otherwise
- confidence: 0 to 1

Available category IDs:
${categoryList}

Important rules:
- "PAYMENT THANK YOU" and "PAIEMENT MERCI" = is_transfer true, amount POSITIVE, category null
- All regular purchases = NEGATIVE amounts
- Refunds/credits = POSITIVE amounts, is_transfer false
- Extract every single transaction, do not summarize or skip any
- Use the post date (second date column) for the date field

Example output format:
[{"date":"2026-04-10","merchant":"Costco","amount":-142.55,"suggested_category_id":null,"is_transfer":false,"confidence":0.95}]`

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      console.error('Gemini error:', JSON.stringify(geminiData))
      return NextResponse.json(
        { error: `Gemini error: ${geminiData?.error?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    console.log('Gemini raw response (first 500 chars):', rawText.substring(0, 500))

    let extracted: any[] = []
    try {
      const clean = rawText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
      extracted = JSON.parse(clean)
      if (!Array.isArray(extracted)) {
        // Maybe it's wrapped in an object
        const keys = Object.keys(extracted)
        for (const key of keys) {
          if (Array.isArray((extracted as any)[key])) {
            extracted = (extracted as any)[key]
            break
          }
        }
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Raw:', rawText.substring(0, 1000))
      return NextResponse.json({
        error: 'Could not parse AI response. Raw: ' + rawText.substring(0, 200)
      }, { status: 500 })
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
        amount: typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0,
        suggested_category_id: categoryId,
        is_transfer_candidate: t.is_transfer || isTransferLike(t.merchant || ''),
        is_duplicate_candidate: false,
        status: 'pending',
        confidence: t.confidence ?? 0.8,
      }
    })

    transactions.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ transactions, count: transactions.length })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Processing failed' }, { status: 500 })
  }
}
