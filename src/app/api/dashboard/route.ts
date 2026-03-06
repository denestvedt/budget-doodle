import { NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'
import { formatShortMonth } from '@/lib/utils/format'

function getNextMonth(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number)
  if (month === 12) return `${year + 1}-01-01`
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

function getLast12Months() {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }
  return months
}

export async function GET() {
  try {
    const { householdId } = await requireHousehold()

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = getNextMonth(currentMonth)
    const last12 = getLast12Months()

    const [accounts, transactions, budgets, snapshots] = await Promise.all([
      sql`
        SELECT id, name, institution, type, class, last_balance, last_updated
        FROM accounts
        WHERE household_id = ${householdId} AND is_active = true
        ORDER BY class, name
      `,
      sql`
        SELECT t.amount, c.group_name, c.type as cat_type
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.household_id = ${householdId}
          AND t.date >= ${currentMonth}
          AND t.date < ${nextMonth}
          AND t.is_transfer = false
      `,
      sql`
        SELECT b.amount, c.group_name, c.type as cat_type
        FROM budgets b
        JOIN categories c ON c.id = b.category_id
        WHERE b.household_id = ${householdId} AND b.month = ${currentMonth}
      `,
      sql`
        SELECT bs.balance, bs.snapshot_date, a.class as account_class
        FROM balance_snapshots bs
        JOIN accounts a ON a.id = bs.account_id
        WHERE bs.household_id = ${householdId}
          AND bs.snapshot_date >= ${last12[0]}
        ORDER BY bs.snapshot_date
      `,
    ])

    // Balance sheet
    const assets = accounts
      .filter((a: any) => a.class === 'Asset')
      .reduce((s: number, a: any) => s + Number(a.last_balance || 0), 0)
    const liabilities = accounts
      .filter((a: any) => a.class === 'Liability')
      .reduce((s: number, a: any) => s + Math.abs(Number(a.last_balance || 0)), 0)

    // Income statement
    let monthIncome = 0
    let monthExpenses = 0
    const groupActuals: Record<string, number> = {}
    for (const t of transactions) {
      if (t.cat_type === 'Income') monthIncome += Math.abs(Number(t.amount))
      else if (t.cat_type === 'Expense') {
        monthExpenses += Math.abs(Number(t.amount))
        groupActuals[t.group_name] = (groupActuals[t.group_name] || 0) + Math.abs(Number(t.amount))
      }
    }

    const groupBudgets: Record<string, number> = {}
    for (const b of budgets) {
      if (b.cat_type === 'Expense') {
        groupBudgets[b.group_name] = (groupBudgets[b.group_name] || 0) + Number(b.amount)
      }
    }

    const GROUP_ORDER = ['Living', 'Discretionary', 'Financial', 'Other']
    const categoryGroups = GROUP_ORDER.map((group) => ({
      group,
      budgeted: groupBudgets[group] || 0,
      actual: groupActuals[group] || 0,
    }))

    // Net worth history
    const netWorthByMonth: Record<string, number> = {}
    for (const snap of snapshots) {
      const month = (snap.snapshot_date as string).substring(0, 7) + '-01'
      const balance =
        snap.account_class === 'Asset'
          ? Number(snap.balance)
          : -Math.abs(Number(snap.balance))
      netWorthByMonth[month] = (netWorthByMonth[month] || 0) + balance
    }
    const netWorthHistory = last12.map((month) => ({
      month: formatShortMonth(month),
      netWorth: netWorthByMonth[month] || 0,
    }))

    const savingsRate =
      monthIncome > 0
        ? Math.max(0, ((monthIncome - monthExpenses) / monthIncome) * 100)
        : 0
    const debtBalance = accounts
      .filter((a: any) => a.type === 'CREDIT')
      .reduce((s: number, a: any) => s + Math.abs(Number(a.last_balance || 0)), 0)
    const investmentBalance = accounts
      .filter((a: any) => a.type === 'INVESTMENT')
      .reduce((s: number, a: any) => s + Number(a.last_balance || 0), 0)

    return NextResponse.json({
      assets,
      liabilities,
      netWorth: assets - liabilities,
      accounts,
      monthIncome,
      monthExpenses,
      categoryGroups,
      netWorthHistory,
      savingsRate,
      debtBalance,
      investmentBalance,
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
