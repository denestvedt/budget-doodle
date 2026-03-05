import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createServerClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = now.getMonth() === 11
    ? `${now.getFullYear() + 1}-01-01`
    : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

  const dayOfMonth = now.getDate()
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthFraction = dayOfMonth / totalDays

  const alerts: Array<{ type: string; message: string; metadata?: object }> = []

  // 1. Category overspend
  const { data: budgets } = await supabase
    .from('budgets')
    .select('category_id, amount, categories(name, group_name)')
    .eq('month', currentMonth)
    .gt('amount', 0)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .gte('date', currentMonth)
    .lt('date', nextMonth)
    .eq('is_transfer', false)
    .not('category_id', 'is', null)

  const actualByCategory: Record<string, number> = {}
  for (const tx of transactions || []) {
    if (!tx.category_id) continue
    actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] || 0) + Math.abs(tx.amount)
  }

  for (const budget of (budgets as any[]) || []) {
    const actual = actualByCategory[budget.category_id] || 0
    const cat = budget.categories

    // Check overspend
    if (actual > budget.amount) {
      alerts.push({
        type: 'category_overspend',
        message: `${cat?.name} is over budget: spent $${actual.toFixed(0)} vs $${budget.amount.toFixed(0)} budgeted`,
        metadata: { category_id: budget.category_id, actual, budgeted: budget.amount },
      })
    }
    // Check mid-month pace warning (>10% over projected)
    else {
      const projected = monthFraction > 0 ? actual / monthFraction : 0
      if (projected > budget.amount * 1.10 && actual > budget.amount * 0.5) {
        alerts.push({
          type: 'mid_month_pace_warning',
          message: `${cat?.name} is on pace to exceed budget — projected $${projected.toFixed(0)} vs $${budget.amount.toFixed(0)} budget`,
          metadata: { category_id: budget.category_id, projected, budgeted: budget.amount },
        })
      }
    }
  }

  // 2. Uncategorized backlog
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const { count: backlogCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .is('category_id', null)
    .eq('is_reviewed', false)
    .lt('imported_at', threeDaysAgo.toISOString())

  if ((backlogCount || 0) > 5) {
    alerts.push({
      type: 'uncategorized_backlog',
      message: `${backlogCount} transactions have been uncategorized for more than 3 days`,
      metadata: { count: backlogCount },
    })
  }

  // 3. Weekly review reminder (Sundays)
  if (now.getDay() === 0) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    const { data: existingWeekly } = await supabase
      .from('weekly_reviews')
      .select('id')
      .gte('week_start', weekStart.toISOString().substring(0, 10))
      .single()

    if (!existingWeekly) {
      alerts.push({
        type: 'weekly_review_reminder',
        message: 'Sunday review: Check this week\'s spending and categorize any pending transactions',
      })
    }
  }

  // 4. Monthly review reminder (first day of month)
  if (dayOfMonth === 1) {
    const prevMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12-01`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`

    const { data: existingMonthly } = await supabase
      .from('monthly_reviews')
      .select('id')
      .eq('month', prevMonth)
      .not('completed_at', 'is', null)
      .single()

    if (!existingMonthly) {
      alerts.push({
        type: 'monthly_review_reminder',
        message: `Monthly review due: Review ${new Date(prevMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} actuals vs budget`,
        metadata: { month: prevMonth },
      })
    }
  }

  // Insert new alerts (deduplicate by type + recent time window)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  for (const alert of alerts) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', alert.type)
      .gt('created_at', oneHourAgo)
      .single()

    if (!existing) {
      await supabase.from('notifications').insert({
        type: alert.type,
        message: alert.message,
        metadata: alert.metadata || null,
        is_read: false,
      })
    }
  }

  return NextResponse.json({ generated: alerts.length, alerts })
}
