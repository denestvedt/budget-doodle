'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatCurrency,
  formatPercent,
  getCurrentMonthStart,
  getDayOfMonth,
  getTotalDaysInCurrentMonth,
  getDaysRemaining,
} from '@/lib/utils/format'

interface BudgetRow {
  category_id: string
  name: string
  group_name: string
  budgeted: number
  actual: number
}

interface GroupedBudget {
  group: string
  rows: BudgetRow[]
  totalBudgeted: number
  totalActual: number
}

const GROUP_ORDER = ['Income', 'Living', 'Discretionary', 'Financial', 'Transfer', 'Other']

export default function MonthlyBudgetPage() {
  const [month, setMonth] = useState(getCurrentMonthStart())
  const [groups, setGroups] = useState<GroupedBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const nextMonth = getNextMonth(month)

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, group_name, type')
      .eq('is_hidden', false)
      .order('group_name')
      .order('sort_order')
      .order('name')

    const { data: budgets } = await supabase
      .from('budgets')
      .select('category_id, amount')
      .eq('month', month)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .gte('date', month)
      .lt('date', nextMonth)
      .eq('is_transfer', false)
      .not('category_id', 'is', null)

    // Build budget map
    const budgetMap = new Map<string, number>()
    for (const b of budgets || []) {
      budgetMap.set(b.category_id, b.amount)
    }

    // Build actuals map
    const actualMap = new Map<string, number>()
    for (const t of transactions || []) {
      if (!t.category_id) continue
      actualMap.set(t.category_id, (actualMap.get(t.category_id) || 0) + Math.abs(t.amount))
    }

    // Build grouped structure
    const groupMap = new Map<string, BudgetRow[]>()
    for (const cat of categories || []) {
      if (!groupMap.has(cat.group_name)) groupMap.set(cat.group_name, [])
      groupMap.get(cat.group_name)!.push({
        category_id: cat.id,
        name: cat.name,
        group_name: cat.group_name,
        budgeted: budgetMap.get(cat.id) || 0,
        actual: actualMap.get(cat.id) || 0,
      })
    }

    const grouped: GroupedBudget[] = GROUP_ORDER
      .filter((g) => groupMap.has(g))
      .map((g) => {
        const rows = groupMap.get(g) || []
        return {
          group: g,
          rows,
          totalBudgeted: rows.reduce((s, r) => s + r.budgeted, 0),
          totalActual: rows.reduce((s, r) => s + r.actual, 0),
        }
      })

    setGroups(grouped)
    setLoading(false)
  }, [supabase, month])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveBudget = async (categoryId: string) => {
    const amount = parseFloat(budgetInput)
    if (isNaN(amount)) {
      setEditingBudget(null)
      return
    }

    setSaving(true)
    await supabase
      .from('budgets')
      .upsert({ category_id: categoryId, month, amount }, { onConflict: 'household_id,category_id,month' })

    setEditingBudget(null)
    setBudgetInput('')
    setSaving(false)
    loadData()
  }

  const dayOfMonth = getDayOfMonth()
  const totalDays = getTotalDaysInCurrentMonth()
  const daysRemaining = getDaysRemaining()
  const monthProgress = (dayOfMonth / totalDays) * 100

  // Total income vs expenses
  const incomeGroup = groups.find((g) => g.group === 'Income')
  const expenseGroups = groups.filter((g) => g.group !== 'Income' && g.group !== 'Transfer')
  const totalExpenseBudget = expenseGroups.reduce((s, g) => s + g.totalBudgeted, 0)
  const totalExpenseActual = expenseGroups.reduce((s, g) => s + g.totalActual, 0)

  const getPaceStatus = (actual: number, budgeted: number) => {
    if (budgeted === 0) return null
    const paceTarget = (dayOfMonth / totalDays) * budgeted
    const ratio = actual / budgeted
    if (actual > budgeted) return 'over'
    if (actual > paceTarget * 1.1) return 'warning'
    return 'ok'
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Monthly Budget
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Day {dayOfMonth} of {totalDays} · {daysRemaining} days remaining
          </p>
        </div>
        <div>
          <input
            type="month"
            value={month.substring(0, 7)}
            onChange={(e) => setMonth(e.target.value + '-01')}
            className="form-input"
          />
        </div>
      </div>

      {/* Month progress */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Month Progress</span>
            <span className="text-sm text-gray-500">{dayOfMonth}/{totalDays} days ({formatPercent(monthProgress, 0)})</span>
          </div>
          <div className="progress-bar h-3">
            <div
              className="progress-bar-fill h-3"
              style={{ width: `${monthProgress}%`, backgroundColor: '#2E6DA4' }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-xs text-gray-500 uppercase">Total Budgeted</div>
              <div className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>
                {formatCurrency(totalExpenseBudget)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Spent So Far</div>
              <div
                className="text-xl font-bold"
                style={{
                  fontFamily: 'Georgia, serif',
                  color: totalExpenseActual > totalExpenseBudget ? '#dc2626' : '#1E3A5F',
                }}
              >
                {formatCurrency(totalExpenseActual)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Remaining</div>
              <div
                className="text-xl font-bold"
                style={{
                  fontFamily: 'Georgia, serif',
                  color: totalExpenseBudget - totalExpenseActual < 0 ? '#dc2626' : '#16a34a',
                }}
              >
                {formatCurrency(totalExpenseBudget - totalExpenseActual)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget groups */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.group} className="card overflow-hidden">
              {/* Group header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#f0f4f9' }}>
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                  {group.group}
                </h3>
                <div className="flex gap-6 text-sm">
                  <span className="text-gray-500">
                    Budget: <span className="font-semibold text-gray-700">{formatCurrency(group.totalBudgeted)}</span>
                  </span>
                  <span className="text-gray-500">
                    Actual: <span className={`font-semibold ${group.totalActual > group.totalBudgeted && group.totalBudgeted > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatCurrency(group.totalActual)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Category rows */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium w-48">Category</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium w-28">Budgeted</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium w-28">Actual</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-400 font-medium w-28">Remaining</th>
                    <th className="px-4 py-2 text-xs text-gray-400 font-medium">Progress</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-400 font-medium w-24">Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const remaining = row.budgeted - row.actual
                    const pct = row.budgeted > 0 ? Math.min(100, (row.actual / row.budgeted) * 100) : 0
                    const pace = getPaceStatus(row.actual, row.budgeted)

                    return (
                      <tr key={row.category_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                        <td className="px-4 py-3 text-right">
                          {editingBudget === row.category_id ? (
                            <input
                              type="number"
                              value={budgetInput}
                              onChange={(e) => setBudgetInput(e.target.value)}
                              onBlur={() => saveBudget(row.category_id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveBudget(row.category_id)
                                if (e.key === 'Escape') { setEditingBudget(null); setBudgetInput('') }
                              }}
                              autoFocus
                              className="w-24 px-2 py-1 text-right border rounded text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingBudget(row.category_id)
                                setBudgetInput(row.budgeted > 0 ? String(row.budgeted) : '')
                              }}
                              className="text-right hover:bg-gray-100 rounded px-2 py-1 transition-colors text-gray-700 w-full"
                            >
                              {row.budgeted > 0 ? formatCurrency(row.budgeted) : <span className="text-gray-300">—</span>}
                            </button>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${row.actual > row.budgeted && row.budgeted > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {row.actual > 0 ? formatCurrency(row.actual) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${remaining < 0 ? 'text-red-600' : remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {row.budgeted > 0 ? formatCurrency(Math.abs(remaining)) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.budgeted > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="progress-bar flex-1" style={{ height: '6px' }}>
                                <div
                                  className="progress-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    height: '6px',
                                    backgroundColor: pct > 100 ? '#dc2626' : pct > 80 ? '#E8A020' : '#2E6DA4',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pace === 'over' && <span className="badge-red">Over</span>}
                          {pace === 'warning' && <span className="badge-amber">On pace</span>}
                          {pace === 'ok' && <span className="badge-green">On track</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  if (month === 12) return `${year + 1}-01-01`
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}
