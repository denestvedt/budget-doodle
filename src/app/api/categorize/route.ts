import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

interface CategorizeRequest {
  transactions: Array<{
    id: string
    description: string
    amount: number
  }>
}

interface CategoryResult {
  id: string
  category: string
  confidence: number
  reasoning: string
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: CategorizeRequest = await request.json()
  const { transactions } = body

  if (!transactions || transactions.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Load categories for this household
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, group_name, type')
    .eq('is_hidden', false)
    .order('group_name')
    .order('name')

  if (!categories || categories.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Load existing rules
  const { data: rules } = await supabase
    .from('category_rules')
    .select('merchant_pattern, category_id, confidence')

  const ruleMap = new Map<string, { category_id: string; confidence: number }>()
  for (const rule of rules || []) {
    ruleMap.set(rule.merchant_pattern.toLowerCase(), {
      category_id: rule.category_id,
      confidence: rule.confidence,
    })
  }

  const results: CategoryResult[] = []
  const needsAI: typeof transactions = []

  // Step 1: Check rule cache
  for (const tx of transactions) {
    const pattern = tx.description.toLowerCase().trim()
    const cachedRule = ruleMap.get(pattern)

    // Also check partial matches
    let matchedRule: { category_id: string; confidence: number } | undefined = cachedRule
    if (!matchedRule) {
      for (const [rulePattern, rule] of ruleMap) {
        if (pattern.includes(rulePattern) || rulePattern.includes(pattern.split(' ')[0])) {
          matchedRule = rule
          break
        }
      }
    }

    if (matchedRule) {
      const cat = categories.find((c) => c.id === matchedRule!.category_id)
      if (cat) {
        results.push({
          id: tx.id,
          category: cat.name,
          confidence: matchedRule.confidence,
          reasoning: 'Matched from rule cache',
        })
        // Update last_used_at
        await supabase
          .from('category_rules')
          .update({ last_used_at: new Date().toISOString(), match_count: supabase.rpc('increment' as any) })
          .eq('merchant_pattern', pattern)
        continue
      }
    }

    needsAI.push(tx)
  }

  // Step 2: AI categorization for uncached transactions
  if (needsAI.length > 0 && process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const categoryList = categories
      .map((c) => `${c.name} (${c.group_name})`)
      .join(', ')

    // Process in batches of 10
    const batchSize = 10
    for (let i = 0; i < needsAI.length; i += batchSize) {
      const batch = needsAI.slice(i, i + batchSize)

      try {
        const txList = batch
          .map((tx, idx) => `${idx + 1}. Description: "${tx.description}", Amount: $${Math.abs(tx.amount)}`)
          .join('\n')

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a household budgeting assistant. Categorize transactions using ONLY the provided category list. Return a JSON array only, no other text.`,
            },
            {
              role: 'user',
              content: `Categorize these ${batch.length} transactions:

${txList}

Available categories: ${categoryList}

Return JSON array: [{"index": 1, "category": "...", "confidence": 0.0-1.0, "reasoning": "..."}]`,
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          const aiResults = parsed.results || parsed.categorizations || (Array.isArray(parsed) ? parsed : [])

          for (const aiResult of aiResults) {
            const idx = (aiResult.index || 1) - 1
            const tx = batch[idx]
            if (!tx) continue

            const cat = categories.find(
              (c) => c.name.toLowerCase() === aiResult.category?.toLowerCase()
            )

            results.push({
              id: tx.id,
              category: cat?.name || aiResult.category || 'Misc',
              confidence: aiResult.confidence || 0.5,
              reasoning: aiResult.reasoning || '',
            })
          }
        }
      } catch (err) {
        console.error('AI categorization error:', err)
        // Add uncategorized results for failed batch
        for (const tx of batch) {
          results.push({
            id: tx.id,
            category: '',
            confidence: 0,
            reasoning: 'AI categorization failed',
          })
        }
      }
    }
  } else if (needsAI.length > 0) {
    // No AI configured, return uncategorized
    for (const tx of needsAI) {
      results.push({
        id: tx.id,
        category: '',
        confidence: 0,
        reasoning: 'No AI configured',
      })
    }
  }

  return NextResponse.json({ results })
}
