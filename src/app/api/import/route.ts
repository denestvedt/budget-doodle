import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

interface ImportTransaction {
  date: string
  description: string
  full_description: string | null
  amount: number
  dedupHash: string
}

export async function POST(request: NextRequest) {
  try {
    const { householdId, userId } = await requireHousehold()
    const body = await request.json()
    const { accountId, transactions, endingBalance } = body as {
      accountId: string
      transactions: ImportTransaction[]
      endingBalance?: number
    }

    // Verify account belongs to this household
    const [account] = await sql`
      SELECT id FROM accounts WHERE id = ${accountId} AND household_id = ${householdId}
    `
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // Load category rules for matching
    const rules = await sql`
      SELECT merchant_pattern, category_id, confidence
      FROM category_rules
      WHERE household_id = ${householdId}
    `
    const ruleMap = new Map(
      rules.map((r: any) => [
        r.merchant_pattern.toLowerCase(),
        { category_id: r.category_id, confidence: Number(r.confidence) },
      ])
    )

    let inserted = 0
    let duplicates = 0
    let errors = 0

    const BATCH = 50
    for (let i = 0; i < transactions.length; i += BATCH) {
      const batch = transactions.slice(i, i + BATCH)

      for (const tx of batch) {
        // Match rule cache
        const pattern = tx.description.toLowerCase().trim()
        let categoryId: string | null = null
        let aiConfidence: number | null = null
        let isReviewed = false

        const rule = ruleMap.get(pattern)
        if (rule) {
          categoryId = rule.category_id
          aiConfidence = rule.confidence
          isReviewed = rule.confidence >= 0.85
        }

        try {
          const result = await sql`
            INSERT INTO transactions
              (household_id, account_id, date, description, full_description, amount,
               category_id, ai_confidence, is_reviewed, is_transfer, dedup_hash, imported_by_user_id)
            VALUES
              (${householdId}, ${accountId}, ${tx.date}, ${tx.description}, ${tx.full_description},
               ${tx.amount}, ${categoryId}, ${aiConfidence}, ${isReviewed}, false,
               ${tx.dedupHash}, ${userId})
            ON CONFLICT (household_id, dedup_hash) DO NOTHING
            RETURNING id
          `
          if (result.length > 0) inserted++
          else duplicates++
        } catch {
          errors++
        }
      }
    }

    // Update account balance
    if (endingBalance !== undefined && endingBalance !== null) {
      await sql`
        UPDATE accounts
        SET last_balance = ${endingBalance}, last_updated = NOW()
        WHERE id = ${accountId} AND household_id = ${householdId}
      `
      const today = new Date().toISOString().substring(0, 10)
      await sql`
        INSERT INTO balance_snapshots (household_id, account_id, balance, snapshot_date, source)
        VALUES (${householdId}, ${accountId}, ${endingBalance}, ${today}, 'csv_import')
        ON CONFLICT (account_id, snapshot_date) DO UPDATE SET balance = EXCLUDED.balance
      `
    }

    // Fire AI categorization async (don't await — let it run in background)
    if (inserted > 0) {
      const uncategorized = await sql`
        SELECT id, description, amount FROM transactions
        WHERE household_id = ${householdId} AND account_id = ${accountId}
          AND category_id IS NULL
        LIMIT 100
      `
      if (uncategorized.length > 0) {
        // Best-effort — ignore errors
        fetch(`${request.nextUrl.origin}/api/categorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-household-id': householdId },
          body: JSON.stringify({ transactions: uncategorized }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ inserted, duplicates, errors, total: transactions.length })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
