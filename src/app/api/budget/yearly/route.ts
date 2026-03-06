import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const year = Number(new URL(request.url).searchParams.get('year') ?? new Date().getFullYear())
    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`

    const [categories, budgets, transactions] = await Promise.all([
      sql`
        SELECT id, name, group_name, type
        FROM categories
        WHERE household_id = ${householdId} AND is_hidden = false
        ORDER BY group_name, sort_order, name
      `,
      sql`
        SELECT category_id, month, amount FROM budgets
        WHERE household_id = ${householdId}
          AND month >= ${yearStart} AND month < ${yearEnd}
      `,
      sql`
        SELECT category_id, date, ABS(amount) as amount
        FROM transactions
        WHERE household_id = ${householdId}
          AND date >= ${yearStart} AND date < ${yearEnd}
          AND is_transfer = false AND category_id IS NOT NULL
      `,
    ])

    const budgetMap = new Map<string, number>()
    for (const b of budgets) {
      budgetMap.set(`${b.category_id}|${(b.month as string).substring(0, 7)}-01`, Number(b.amount))
    }

    const actualMap = new Map<string, number>()
    for (const t of transactions) {
      const monthKey = (t.date as string).substring(0, 7) + '-01'
      const key = `${t.category_id}|${monthKey}`
      actualMap.set(key, (actualMap.get(key) || 0) + Number(t.amount))
    }

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return `${year}-${String(m).padStart(2, '0')}-01`
    })

    const rows = (categories as any[]).map((cat) => {
      const monthData: Record<string, { budgeted: number; actual: number }> = {}
      let totalBudgeted = 0
      let totalActual = 0
      for (const month of months) {
        const key = `${cat.id}|${month}`
        const budgeted = budgetMap.get(key) ?? 0
        const actual = actualMap.get(key) ?? 0
        monthData[month] = { budgeted, actual }
        totalBudgeted += budgeted
        totalActual += actual
      }
      return { category_id: cat.id, name: cat.name, group_name: cat.group_name, months: monthData, totalBudgeted, totalActual }
    })

    return NextResponse.json({ rows, year })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
