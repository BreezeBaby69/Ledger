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

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Just the raw JSON array starting with [ and ending with ].

Each object must have:
- date: "YYYY-MM-DD" (use the post/transaction date)
- merchant: clean merchant name
- amount: number, NEGATIVE for purchases, POSITIVE for payments and refunds
- suggested_category_id: one of the IDs below or null
- is_transfer: true for payments/transfers only
- confidence: 0 to 1

Available category IDs:
${categoryList}

Start your response with [ and end with ]. Nothing before or after the array.`

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
        { error: `Gemini error: ${geminiData?.error?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const rawText = (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()

    // Extract JSON array from anywhere in the response
    let extracted: any[] = []
    try {
      // Find the first [ and last ] and parse what's between them
      const start = rawText.indexOf('[')
      const end = rawText.lastIndexOf(']')
      if (start === -1 || end === -1) {
        throw new Error('No JSON array found in response')
      }
      const jsonStr = rawText.substring(start, end + 1)
      extracted = JSON.parse(jsonStr)
      if (!Array.isArray(extracted)) extracted = []
    } catch (parseErr: any) {
      return NextResponse.json({
        error: 'Could not parse AI response: ' + parseErr.message
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
