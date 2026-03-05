'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'

interface YearlyRow {
  category_id: string
  name: string
  group_name: string
  months: Record<string, { budgeted: number; actual: number }>
  totalBudgeted: number
  totalActual: number
}

const GROUP_ORDER = ['Income', 'Living', 'Discretionary', 'Financial', 'Other']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function YearlyBudgetPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<YearlyRow[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return `${year}-${String(m).padStart(2, '0')}-01`
  })

  const loadData = useCallback(async () => {
    setLoading(true)

    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, group_name, type')
      .eq('is_hidden', false)
      .order('group_name')
      .order('sort_order')
      .order('name')

    const { data: budgets } = await supabase
      .from('budgets')
      .select('category_id, month, amount')
      .gte('month', yearStart)
      .lt('month', yearEnd)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('category_id, amount, date')
      .gte('date', yearStart)
      .lt('date', yearEnd)
      .eq('is_transfer', false)
      .not('category_id', 'is', null)

    // Build maps
    const budgetMap = new Map<string, number>() // key: "cat_id|month"
    for (const b of budgets || []) {
      budgetMap.set(`${b.category_id}|${b.month}`, b.amount)
    }

    const actualMap = new Map<string, number>()
    for (const t of transactions || []) {
      if (!t.category_id) continue
      const monthKey = t.date.substring(0, 7) + '-01'
      const key = `${t.category_id}|${monthKey}`
      actualMap.set(key, (actualMap.get(key) || 0) + Math.abs(t.amount))
    }

    // Build rows
    const yearlyRows: YearlyRow[] = (categories || []).map((cat) => {
      const monthData: Record<string, { budgeted: number; actual: number }> = {}
      let totalBudgeted = 0
      let totalActual = 0

      for (const month of months) {
        const key = `${cat.id}|${month}`
        const budgeted = budgetMap.get(key) || 0
        const actual = actualMap.get(key) || 0
        monthData[month] = { budgeted, actual }
        totalBudgeted += budgeted
        totalActual += actual
      }

      return {
        category_id: cat.id,
        name: cat.name,
        group_name: cat.group_name,
        months: monthData,
        totalBudgeted,
        totalActual,
      }
    })

    setRows(yearlyRows)
    setLoading(false)
  }, [supabase, year])

  useEffect(() => {
    loadData()
  }, [loadData])

  const groupedRows = GROUP_ORDER
    .map((group) => ({
      group,
      rows: rows.filter((r) => r.group_name === group),
    }))
    .filter((g) => g.rows.length > 0)

  const getCellColor = (budgeted: number, actual: number, monthIdx: number) => {
    const isCurrentMonth = year === currentYear && monthIdx + 1 === currentMonth
    const isFuture = year > currentYear || (year === currentYear && monthIdx + 1 > currentMonth)

    if (isFuture && !isCurrentMonth) return 'bg-gray-50 text-gray-300'
    if (budgeted === 0 && actual === 0) return 'text-gray-300'
    if (actual > budgeted && budgeted > 0) return 'bg-red-50 text-red-700 font-medium'
    if (actual <= budgeted && budgeted > 0) return 'bg-green-50 text-green-700 font-medium'
    return 'text-gray-700'
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Yearly Budget
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Budget vs. actual for each category · Color: green = under, red = over</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="btn-secondary py-1.5 px-3"
          >
            ← {year - 1}
          </button>
          <span className="font-bold text-lg" style={{ color: '#1E3A5F' }}>{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="btn-secondary py-1.5 px-3"
          >
            {year + 1} →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: '#1E3A5F', color: 'white' }}>
                  <th className="px-3 py-3 text-left font-semibold sticky left-0 z-10" style={{ backgroundColor: '#1E3A5F', minWidth: '160px' }}>
                    Category
                  </th>
                  {MONTH_NAMES.map((m, i) => (
                    <th
                      key={m}
                      className="px-2 py-3 text-right font-semibold"
                      style={{
                        minWidth: '72px',
                        backgroundColor: year === currentYear && i + 1 === currentMonth ? '#2E6DA4' : '#1E3A5F',
                      }}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-semibold" style={{ minWidth: '80px', backgroundColor: '#162d4a' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(({ group, rows: groupRows }) => (
                  <>
                    {/* Group header */}
                    <tr key={`group-${group}`} style={{ backgroundColor: '#f0f4f9' }}>
                      <td
                        colSpan={14}
                        className="px-3 py-2 font-bold text-xs uppercase tracking-wide sticky left-0"
                        style={{ color: '#1E3A5F', backgroundColor: '#f0f4f9' }}
                      >
                        {group}
                      </td>
                    </tr>
                    {groupRows.map((row) => (
                      <tr key={row.category_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td
                          className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white"
                          style={{ minWidth: '160px' }}
                        >
                          {row.name}
                        </td>
                        {months.map((month, i) => {
                          const data = row.months[month]
                          const cellClass = getCellColor(data.budgeted, data.actual, i)
                          return (
                            <td key={month} className={`px-2 py-2 text-right ${cellClass}`} style={{ minWidth: '72px' }}>
                              {data.actual > 0 && (
                                <div>{formatCurrency(data.actual)}</div>
                              )}
                              {data.budgeted > 0 && (
                                <div className="text-gray-400 font-normal">{formatCurrency(data.budgeted)}</div>
                              )}
                              {data.actual === 0 && data.budgeted === 0 && '—'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-bold" style={{ minWidth: '80px', backgroundColor: '#f8fafc' }}>
                          <div className={row.totalActual > row.totalBudgeted && row.totalBudgeted > 0 ? 'text-red-700' : 'text-gray-800'}>
                            {row.totalActual > 0 ? formatCurrency(row.totalActual) : '—'}
                          </div>
                          {row.totalBudgeted > 0 && (
                            <div className="text-gray-400 font-normal">{formatCurrency(row.totalBudgeted)}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          Under budget
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          Over budget
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Future month
        </div>
      </div>
    </div>
  )
}
