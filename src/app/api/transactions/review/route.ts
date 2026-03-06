import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const { householdId } = await requireHousehold()

    const rows = await sql`
      SELECT
        t.id, t.date, t.description, t.full_description, t.amount,
        t.category_id, t.category_hint, t.ai_confidence, t.is_reviewed,
        c.id as cat_id, c.name as cat_name, c.group_name as cat_group,
        a.id as acct_id, a.name as acct_name, a.institution as acct_institution
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.household_id = ${householdId} AND t.is_reviewed = false
      ORDER BY t.date DESC
      LIMIT 100
    `

    const transactions = rows.map((r: any) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      full_description: r.full_description,
      amount: Number(r.amount),
      category_id: r.category_id,
      category_hint: r.category_hint,
      ai_confidence: r.ai_confidence ? Number(r.ai_confidence) : null,
      is_reviewed: r.is_reviewed,
      categories: r.cat_id ? { id: r.cat_id, name: r.cat_name, group_name: r.cat_group } : null,
      accounts: r.acct_id ? { id: r.acct_id, name: r.acct_name, institution: r.acct_institution } : null,
    }))

    return NextResponse.json(transactions)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const body = await request.json()
    const { confirmations } = body as {
      confirmations: Array<{ id: string; categoryId: string; learnRule: boolean; description: string }>
    }

    for (const item of confirmations) {
      await sql`
        UPDATE transactions
        SET category_id = ${item.categoryId}, is_reviewed = true
        WHERE id = ${item.id} AND household_id = ${householdId}
      `

      if (item.learnRule) {
        const pattern = item.description.toLowerCase().trim()
        await sql`
          INSERT INTO category_rules (household_id, merchant_pattern, category_id, confidence, last_used_at)
          VALUES (${householdId}, ${pattern}, ${item.categoryId}, 1.0, NOW())
          ON CONFLICT (household_id, merchant_pattern)
          DO UPDATE SET category_id = EXCLUDED.category_id, confidence = 1.0,
            last_used_at = NOW(), match_count = category_rules.match_count + 1
        `
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
