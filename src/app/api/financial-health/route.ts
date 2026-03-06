import { NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'
import { formatShortMonth } from '@/lib/utils/format'

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
    const last12 = getLast12Months()

    const [accounts, snapshots, transactions] = await Promise.all([
      sql`
        SELECT id, type, class FROM accounts
        WHERE household_id = ${householdId} AND is_active = true
      `,
      sql`
        SELECT bs.account_id, bs.balance, bs.snapshot_date, a.class as account_class, a.type as account_type
        FROM balance_snapshots bs
        JOIN accounts a ON a.id = bs.account_id
        WHERE bs.household_id = ${householdId} AND bs.snapshot_date >= ${last12[0]}
        ORDER BY bs.snapshot_date
      `,
      sql`
        SELECT t.amount, t.date, c.type as cat_type
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.household_id = ${householdId}
          AND t.date >= ${last12[0]}
          AND t.is_transfer = false
          AND t.category_id IS NOT NULL
      `,
    ])

    // Monthly income/expense
    const monthlyIncome: Record<string, number> = {}
    const monthlyExpenses: Record<string, number> = {}
    for (const t of transactions) {
      const monthKey = (t.date as string).substring(0, 7) + '-01'
      if (t.cat_type === 'Income') {
        monthlyIncome[monthKey] = (monthlyIncome[monthKey] || 0) + Math.abs(Number(t.amount))
      } else if (t.cat_type === 'Expense') {
        monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + Math.abs(Number(t.amount))
      }
    }

    // Balance per month (latest snapshot per account per month)
    const latestBalances: Record<string, { balance: number; class: string; type: string }> = {}
    const snapshotByMonth: Record<string, typeof snapshots> = {}
    for (const snap of snapshots) {
      const monthKey = (snap.snapshot_date as string).substring(0, 7) + '-01'
      if (!snapshotByMonth[monthKey]) snapshotByMonth[monthKey] = []
      snapshotByMonth[monthKey].push(snap)
    }

    const metrics = last12.map((month) => {
      if (snapshotByMonth[month]) {
        for (const snap of snapshotByMonth[month]) {
          latestBalances[snap.account_id] = {
            balance: Number(snap.balance),
            class: snap.account_class,
            type: snap.account_type,
          }
        }
      }

      let netWorth = 0
      let debtBalance = 0
      let investmentBalance = 0
      for (const acct of Object.values(latestBalances)) {
        if (acct.class === 'Asset') {
          netWorth += acct.balance
          if (acct.type === 'INVESTMENT') investmentBalance += acct.balance
        } else {
          netWorth -= Math.abs(acct.balance)
          if (acct.type === 'CREDIT') debtBalance += Math.abs(acct.balance)
        }
      }

      const income = monthlyIncome[month] || 0
      const expenses = monthlyExpenses[month] || 0
      const savingsRate = income > 0 ? Math.max(0, ((income - expenses) / income) * 100) : 0

      return {
        month,
        label: formatShortMonth(month),
        netWorth,
        savingsRate,
        debtBalance,
        investmentBalance,
        income,
        expenses,
      }
    })

    return NextResponse.json(metrics)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
