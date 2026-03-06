import { NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function POST() {
  try {
    const { householdId } = await requireHousehold()

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
    const dayOfMonth = now.getDate()
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthFraction = dayOfMonth / totalDays
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString()

    const alerts: Array<{ type: string; message: string; metadata?: object }> = []

    const [budgets, transactions] = await Promise.all([
      sql`
        SELECT b.category_id, b.amount, c.name as cat_name
        FROM budgets b JOIN categories c ON c.id = b.category_id
        WHERE b.household_id = ${householdId} AND b.month = ${currentMonth} AND b.amount > 0
      `,
      sql`
        SELECT category_id, ABS(amount) as amount FROM transactions
        WHERE household_id = ${householdId}
          AND date >= ${currentMonth} AND date < ${nextMonth}
          AND is_transfer = false AND category_id IS NOT NULL
      `,
    ])

    const actualByCategory: Record<string, number> = {}
    for (const t of transactions) {
      actualByCategory[t.category_id] = (actualByCategory[t.category_id] || 0) + Number(t.amount)
    }

    for (const budget of budgets) {
      const actual = actualByCategory[budget.category_id] || 0
      if (actual > Number(budget.amount)) {
        alerts.push({
          type: 'category_overspend',
          message: `${budget.cat_name} is over budget: spent $${actual.toFixed(0)} vs $${Number(budget.amount).toFixed(0)} budgeted`,
          metadata: { category_id: budget.category_id, actual, budgeted: Number(budget.amount) },
        })
      } else {
        const projected = monthFraction > 0 ? actual / monthFraction : 0
        if (projected > Number(budget.amount) * 1.1 && actual > Number(budget.amount) * 0.5) {
          alerts.push({
            type: 'mid_month_pace_warning',
            message: `${budget.cat_name} is on pace to exceed budget — projected $${projected.toFixed(0)} vs $${Number(budget.amount).toFixed(0)}`,
          })
        }
      }
    }

    // Uncategorized backlog (>5 transactions older than 3 days)
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString()
    const [backlogRow] = await sql`
      SELECT COUNT(*) as count FROM transactions
      WHERE household_id = ${householdId}
        AND category_id IS NULL AND is_reviewed = false
        AND imported_at < ${threeDaysAgo}
    `
    if (Number(backlogRow.count) > 5) {
      alerts.push({
        type: 'uncategorized_backlog',
        message: `${backlogRow.count} transactions have been uncategorized for more than 3 days`,
      })
    }

    // Weekly reminder (Sundays)
    if (now.getDay() === 0) {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().substring(0, 10)
      const [existing] = await sql`
        SELECT id FROM weekly_reviews
        WHERE household_id = ${householdId} AND week_start >= ${weekAgo}
      `
      if (!existing) {
        alerts.push({ type: 'weekly_review_reminder', message: "Sunday review: Check this week's spending" })
      }
    }

    // Monthly reminder (1st of month)
    if (dayOfMonth === 1) {
      const prevMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12-01`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`
      const [existing] = await sql`
        SELECT id FROM monthly_reviews
        WHERE household_id = ${householdId} AND month = ${prevMonth} AND completed_at IS NOT NULL
      `
      if (!existing) {
        alerts.push({
          type: 'monthly_review_reminder',
          message: `Monthly review due for ${new Date(prevMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        })
      }
    }

    // Insert deduped
    for (const alert of alerts) {
      const [existing] = await sql`
        SELECT id FROM notifications
        WHERE household_id = ${householdId} AND type = ${alert.type} AND created_at > ${oneHourAgo}
      `
      if (!existing) {
        await sql`
          INSERT INTO notifications (household_id, type, message, metadata, is_read)
          VALUES (${householdId}, ${alert.type}, ${alert.message}, ${JSON.stringify(alert.metadata ?? null)}, false)
        `
      }
    }

    return NextResponse.json({ generated: alerts.length })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
