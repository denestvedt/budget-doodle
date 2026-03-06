import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

function getNextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
}

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const month = new URL(request.url).searchParams.get('month') ??
      (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01` })()

    const nextMonth = getNextMonth(month)

    const [categories, budgets, transactions] = await Promise.all([
      sql`
        SELECT id, name, group_name, type
        FROM categories
        WHERE household_id = ${householdId} AND is_hidden = false
        ORDER BY group_name, sort_order, name
      `,
      sql`
        SELECT category_id, amount FROM budgets
        WHERE household_id = ${householdId} AND month = ${month}
      `,
      sql`
        SELECT category_id, ABS(amount) as amount FROM transactions
        WHERE household_id = ${householdId}
          AND date >= ${month} AND date < ${nextMonth}
          AND is_transfer = false AND category_id IS NOT NULL
      `,
    ])

    const budgetMap = new Map(budgets.map((b: any) => [b.category_id, Number(b.amount)]))
    const actualMap = new Map<string, number>()
    for (const t of transactions) {
      actualMap.set(t.category_id, (actualMap.get(t.category_id) || 0) + Number(t.amount))
    }

    const rows = (categories as any[]).map((cat) => ({
      category_id: cat.id,
      name: cat.name,
      group_name: cat.group_name,
      type: cat.type,
      budgeted: budgetMap.get(cat.id) ?? 0,
      actual: actualMap.get(cat.id) ?? 0,
    }))

    return NextResponse.json({ rows, month })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const { categoryId, month, amount } = await request.json()

    await sql`
      INSERT INTO budgets (household_id, category_id, month, amount)
      VALUES (${householdId}, ${categoryId}, ${month}, ${amount})
      ON CONFLICT (household_id, category_id, month)
      DO UPDATE SET amount = EXCLUDED.amount
    `

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
