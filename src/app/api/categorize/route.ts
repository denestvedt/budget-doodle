import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'
import OpenAI from 'openai'

interface CategorizeRequest {
  transactions: Array<{ id: string; description: string; amount: number }>
}

export async function POST(request: NextRequest) {
  try {
    // Support internal calls from /api/import via x-household-id header
    const internalHouseholdId = request.headers.get('x-household-id')
    let householdId: string

    if (internalHouseholdId) {
      householdId = internalHouseholdId
    } else {
      const ctx = await requireHousehold()
      householdId = ctx.householdId
    }

    const { transactions } = (await request.json()) as CategorizeRequest
    if (!transactions || transactions.length === 0) return NextResponse.json({ results: [] })

    const [categories, rules] = await Promise.all([
      sql`
        SELECT id, name, group_name, type FROM categories
        WHERE household_id = ${householdId} AND is_hidden = false
        ORDER BY group_name, name
      `,
      sql`
        SELECT merchant_pattern, category_id, confidence FROM category_rules
        WHERE household_id = ${householdId}
      `,
    ])

    const ruleMap = new Map(
      (rules as any[]).map((r) => [
        r.merchant_pattern.toLowerCase(),
        { category_id: r.category_id, confidence: Number(r.confidence) },
      ])
    )

    const results: Array<{ id: string; category: string; confidence: number; reasoning: string }> = []
    const needsAI: typeof transactions = []

    // Step 1: rule cache
    for (const tx of transactions) {
      const pattern = tx.description.toLowerCase().trim()
      let matched = ruleMap.get(pattern)
      if (!matched) {
        for (const [rulePattern, rule] of ruleMap) {
          if (pattern.includes(rulePattern) || rulePattern.includes(pattern.split(' ')[0])) {
            matched = rule
            break
          }
        }
      }

      if (matched) {
        const cat = (categories as any[]).find((c) => c.id === matched!.category_id)
        if (cat) {
          results.push({ id: tx.id, category: cat.name, confidence: matched.confidence, reasoning: 'Rule cache' })
          await sql`
            UPDATE category_rules SET last_used_at = NOW(), match_count = match_count + 1
            WHERE household_id = ${householdId} AND merchant_pattern = ${pattern}
          `
          continue
        }
      }
      needsAI.push(tx)
    }

    // Step 2: AI
    if (needsAI.length > 0 && process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const categoryList = (categories as any[]).map((c) => `${c.name} (${c.group_name})`).join(', ')
      const BATCH = 10

      for (let i = 0; i < needsAI.length; i += BATCH) {
        const batch = needsAI.slice(i, i + BATCH)
        try {
          const txList = batch
            .map((tx, idx) => `${idx + 1}. Description: "${tx.description}", Amount: $${Math.abs(tx.amount)}`)
            .join('\n')

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a household budgeting assistant. Categorize transactions using ONLY the provided category list. Return JSON only.' },
              { role: 'user', content: `Categorize these ${batch.length} transactions:\n\n${txList}\n\nAvailable categories: ${categoryList}\n\nReturn JSON: {"results": [{"index": 1, "category": "...", "confidence": 0.0-1.0, "reasoning": "..."}]}` },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          })

          const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
          const aiResults = parsed.results || []

          for (const aiResult of aiResults) {
            const idx = (aiResult.index || 1) - 1
            const tx = batch[idx]
            if (!tx) continue
            const cat = (categories as any[]).find((c) => c.name.toLowerCase() === aiResult.category?.toLowerCase())
            results.push({
              id: tx.id,
              category: cat?.name || aiResult.category || 'Misc',
              confidence: aiResult.confidence || 0.5,
              reasoning: aiResult.reasoning || '',
            })
          }

          // Apply categories to DB
          for (const result of results.filter((r) => batch.some((b) => b.id === r.id))) {
            const cat = (categories as any[]).find((c) => c.name === result.category)
            if (cat) {
              await sql`
                UPDATE transactions
                SET category_id = ${cat.id}, category_hint = ${result.category},
                    ai_confidence = ${result.confidence}, is_reviewed = ${result.confidence >= 0.85}
                WHERE id = ${result.id} AND household_id = ${householdId}
              `
            }
          }
        } catch (err) {
          console.error('AI batch error:', err)
          for (const tx of batch) results.push({ id: tx.id, category: '', confidence: 0, reasoning: 'AI failed' })
        }
      }
    } else {
      for (const tx of needsAI) results.push({ id: tx.id, category: '', confidence: 0, reasoning: 'No AI configured' })
    }

    return NextResponse.json({ results })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
