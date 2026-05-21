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

    const prompt = `Extract all transactions from this Canadian bank or credit card statement.

Return a JSON array of transaction objects. Each object has these fields:
- date: string in YYYY-MM-DD format
- merchant: string, cleaned up merchant name
- amount: number, negative for purchases, positive for payments and refunds
- suggested_category_id: string or null, pick from the list below
- is_transfer: boolean, true only for payments between accounts
- confidence: number between 0 and 1

Category IDs to use:
${categoryList}

Rules:
- PAYMENT THANK YOU = is_transfer true, positive amount
- Regular purchases = negative amounts
- Refunds = positive amounts, is_transfer false
- Extract every transaction, none missing

Return only the JSON array, nothing else.`

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
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        }
      }),
    })

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      return NextResponse.json(
        { error: `Gemini error: ${geminiData?.error?.message || JSON.stringify(geminiData)}` },
        { status: 500 }
      )
    }

    const rawText = (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()

    if (!rawText) {
      return NextResponse.json(
        { error: 'Gemini returned empty response.' },
        { status: 500 }
      )
    }

    // Strip markdown code fences and find the JSON array
    const cleaned = rawText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim()

    let extracted: any[] = []
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')

    if (start !== -1 && end !== -1 && end > start) {
      try {
        extracted = JSON.parse(cleaned.substring(start, end + 1))
      } catch {
        extracted = []
      }
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return NextResponse.json(
        { error: `Could not parse response. AI said: ${cleaned.substring(0, 300)}` },
        { status: 500 }
      )
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
