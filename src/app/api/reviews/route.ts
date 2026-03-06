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
    const url = new URL(request.url)
    const month = url.searchParams.get('month')

    // List of reviews
    const reviews = await sql`
      SELECT id, month, notes, is_locked, completed_at
      FROM monthly_reviews
      WHERE household_id = ${householdId}
      ORDER BY month DESC
      LIMIT 12
    `

    if (!month) return NextResponse.json({ reviews })

    const nextMonth = getNextMonth(month)

    const [review, transactions, budgets, accounts] = await Promise.all([
      sql`
        SELECT id, month, notes, is_locked, completed_at FROM monthly_reviews
        WHERE household_id = ${householdId} AND month = ${month}
      `,
      sql`
        SELECT t.amount, t.category_id, c.name as cat_name, c.group_name, c.type as cat_type
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.household_id = ${householdId}
          AND t.date >= ${month} AND t.date < ${nextMonth}
          AND t.is_transfer = false
      `,
      sql`
        SELECT b.category_id, b.amount FROM budgets b
        WHERE b.household_id = ${householdId} AND b.month = ${month}
      `,
      sql`
        SELECT class, type, last_balance FROM accounts
        WHERE household_id = ${householdId} AND is_active = true
      `,
    ])

    let income = 0, expenses = 0
    const catActual: Record<string, { name: string; group: string; actual: number }> = {}
    for (const t of transactions) {
      if (t.cat_type === 'Income') income += Math.abs(Number(t.amount))
      else if (t.cat_type === 'Expense') {
        expenses += Math.abs(Number(t.amount))
        if (t.category_id) {
          if (!catActual[t.category_id]) catActual[t.category_id] = { name: t.cat_name, group: t.group_name, actual: 0 }
          catActual[t.category_id].actual += Math.abs(Number(t.amount))
        }
      }
    }

    const budgetMap: Record<string, number> = {}
    for (const b of budgets) budgetMap[b.category_id] = Number(b.amount)

    const categoryBreakdown = Object.entries(catActual)
      .map(([id, d]) => ({ ...d, budgeted: budgetMap[id] || 0 }))
      .sort((a, b) => b.actual - a.actual)

    let netWorth = 0, debtBalance = 0, investmentBalance = 0
    for (const a of accounts) {
      if (a.class === 'Asset') { netWorth += Number(a.last_balance); if (a.type === 'INVESTMENT') investmentBalance += Number(a.last_balance) }
      else { netWorth -= Math.abs(Number(a.last_balance)); if (a.type === 'CREDIT') debtBalance += Math.abs(Number(a.last_balance)) }
    }

    const savingsRate = income > 0 ? Math.max(0, ((income - expenses) / income) * 100) : 0

    // Weekly stats (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekStart = sevenDaysAgo.toISOString().substring(0, 10)

    const weekTx = await sql`
      SELECT t.amount, c.name as cat_name, c.type as cat_type, t.is_reviewed, t.category_id
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.household_id = ${householdId}
        AND t.date >= ${weekStart}
        AND t.is_transfer = false
    `

    let weekSpend = 0
    const weekCatSpend: Record<string, number> = {}
    for (const t of weekTx) {
      if (t.cat_type === 'Expense') {
        weekSpend += Math.abs(Number(t.amount))
        if (t.cat_name) weekCatSpend[t.cat_name] = (weekCatSpend[t.cat_name] || 0) + Math.abs(Number(t.amount))
      }
    }

    const topCategories = Object.entries(weekCatSpend)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)

    return NextResponse.json({
      reviews,
      review: review[0] || null,
      reviewData: { income, expenses, netWorth, savingsRate, debtBalance, investmentBalance, categoryBreakdown },
      weeklyStats: { spend: weekSpend, topCategories },
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId, userId } = await requireHousehold()
    const { month, notes, complete, archive } = await request.json()

    const existing = await sql`
      SELECT id FROM monthly_reviews WHERE household_id = ${householdId} AND month = ${month}
    `

    if (existing.length > 0) {
      const updates: Record<string, any> = { notes }
      if (complete) updates.completed_at = new Date().toISOString()
      if (archive) updates.is_locked = true

      await sql`
        UPDATE monthly_reviews
        SET notes = ${notes},
            completed_at = ${complete ? new Date().toISOString() : sql`completed_at`},
            is_locked = ${archive ? true : sql`is_locked`},
            reviewed_by_user_id = ${userId}
        WHERE household_id = ${householdId} AND month = ${month}
      `
    } else {
      await sql`
        INSERT INTO monthly_reviews (household_id, month, notes, reviewed_by_user_id, completed_at)
        VALUES (
          ${householdId}, ${month}, ${notes}, ${userId},
          ${complete ? new Date().toISOString() : null}
        )
      `
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
