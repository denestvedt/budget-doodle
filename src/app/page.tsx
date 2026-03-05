'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatCurrency,
  formatPercent,
  formatShortMonth,
  getCurrentMonthStart,
  getLast12Months,
  getDayOfMonth,
  getTotalDaysInCurrentMonth,
} from '@/lib/utils/format'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

interface DashboardData {
  assets: number
  liabilities: number
  netWorth: number
  accounts: Array<{
    id: string
    name: string
    institution: string
    type: string
    class: string
    last_balance: number
    last_updated: string | null
  }>
  monthIncome: number
  monthExpenses: number
  categoryGroups: Array<{
    group: string
    budgeted: number
    actual: number
  }>
  netWorthHistory: Array<{
    month: string
    netWorth: number
  }>
  savingsRate: number
  debtBalance: number
  investmentBalance: number
}

const GROUP_ORDER = ['Living', 'Discretionary', 'Financial', 'Other']

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    const currentMonth = getCurrentMonthStart()
    const last12 = getLast12Months()

    // Load accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('class')

    // Load current month transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, category_id, categories(name, group_name, type)')
      .gte('date', currentMonth)
      .lt('date', getNextMonth(currentMonth))
      .eq('is_transfer', false)

    // Load budgets for current month
    const { data: budgets } = await supabase
      .from('budgets')
      .select('amount, category_id, categories(name, group_name, type)')
      .eq('month', currentMonth)

    // Load balance snapshots for net worth history
    const { data: snapshots } = await supabase
      .from('balance_snapshots')
      .select('balance, snapshot_date, account_id, accounts(class)')
      .gte('snapshot_date', last12[0])
      .order('snapshot_date')

    if (!accounts) {
      setLoading(false)
      return
    }

    // Calculate balance sheet
    const assets = accounts
      .filter((a) => a.class === 'Asset')
      .reduce((sum, a) => sum + (a.last_balance || 0), 0)
    const liabilities = accounts
      .filter((a) => a.class === 'Liability')
      .reduce((sum, a) => sum + Math.abs(a.last_balance || 0), 0)
    const netWorth = assets - liabilities

    // Calculate income/expense
    let monthIncome = 0
    let monthExpenses = 0
    const groupActuals: Record<string, number> = {}

    if (transactions) {
      for (const t of transactions as any[]) {
        const cat = t.categories
        if (!cat) continue
        if (cat.type === 'Income') {
          monthIncome += Math.abs(t.amount)
        } else if (cat.type === 'Expense') {
          monthExpenses += Math.abs(t.amount)
          groupActuals[cat.group_name] = (groupActuals[cat.group_name] || 0) + Math.abs(t.amount)
        }
      }
    }

    // Build category groups
    const groupBudgets: Record<string, number> = {}
    if (budgets) {
      for (const b of budgets as any[]) {
        const cat = b.categories
        if (!cat || cat.type !== 'Expense') continue
        groupBudgets[cat.group_name] = (groupBudgets[cat.group_name] || 0) + b.amount
      }
    }

    const categoryGroups = GROUP_ORDER.map((group) => ({
      group,
      budgeted: groupBudgets[group] || 0,
      actual: groupActuals[group] || 0,
    }))

    // Build net worth history
    const netWorthByMonth: Record<string, number> = {}
    if (snapshots) {
      for (const snap of snapshots as any[]) {
        const month = snap.snapshot_date.substring(0, 7) + '-01'
        const balance = snap.accounts?.class === 'Asset'
          ? (snap.balance || 0)
          : -(Math.abs(snap.balance || 0))
        netWorthByMonth[month] = (netWorthByMonth[month] || 0) + balance
      }
    }

    const netWorthHistory = last12.map((month) => ({
      month: formatShortMonth(month),
      netWorth: netWorthByMonth[month] || 0,
    }))

    // Savings rate
    const savingsRate = monthIncome > 0
      ? Math.max(0, ((monthIncome - monthExpenses) / monthIncome) * 100)
      : 0

    // Debt and investment balances
    const debtBalance = accounts
      .filter((a) => a.type === 'CREDIT')
      .reduce((sum, a) => sum + Math.abs(a.last_balance || 0), 0)
    const investmentBalance = accounts
      .filter((a) => a.type === 'INVESTMENT')
      .reduce((sum, a) => sum + (a.last_balance || 0), 0)

    setData({
      assets,
      liabilities,
      netWorth,
      accounts: accounts as any[],
      monthIncome,
      monthExpenses,
      categoryGroups,
      netWorthHistory,
      savingsRate,
      debtBalance,
      investmentBalance,
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Loading Dashboard...
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const netCashFlow = data.monthIncome - data.monthExpenses
  const dayOfMonth = getDayOfMonth()
  const totalDays = getTotalDaysInCurrentMonth()

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Financial Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Morning briefing · Day {dayOfMonth} of {totalDays}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Net Worth hero */}
      <div
        className="rounded-xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium opacity-70 uppercase tracking-wide mb-1">Net Worth</div>
            <div className="text-5xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
              {formatCurrency(data.netWorth)}
            </div>
            <div className="flex gap-6 mt-3 text-sm opacity-80">
              <span>Assets: {formatCurrency(data.assets)}</span>
              <span>Liabilities: {formatCurrency(data.liabilities)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-70 mb-1">Savings Rate</div>
            <div className="text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
              {formatPercent(data.savingsRate)}
            </div>
            <div className="text-sm opacity-70 mt-1">this month</div>
          </div>
        </div>
      </div>

      {/* Three-panel grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Panel 1: Balance Sheet */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
              Balance Sheet
            </h2>
          </div>
          <div className="card-body space-y-4">
            {/* Assets */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assets</div>
              <div className="space-y-1">
                {data.accounts
                  .filter((a) => a.class === 'Asset')
                  .map((a) => (
                    <div key={a.id} className="flex justify-between items-center py-1">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.institution}</div>
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(a.last_balance)}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-sm font-semibold text-gray-700">Total Assets</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(data.assets)}</span>
              </div>
            </div>

            {/* Liabilities */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Liabilities</div>
              <div className="space-y-1">
                {data.accounts
                  .filter((a) => a.class === 'Liability')
                  .map((a) => (
                    <div key={a.id} className="flex justify-between items-center py-1">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.institution}</div>
                      </div>
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(Math.abs(a.last_balance))}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-sm font-semibold text-gray-700">Total Liabilities</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(data.liabilities)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Income Statement */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
              Income Statement
            </h2>
            <div className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="card-body space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium uppercase">Income</div>
                <div className="text-xl font-bold text-green-700 mt-1">
                  {formatCurrency(data.monthIncome)}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 font-medium uppercase">Expenses</div>
                <div className="text-xl font-bold text-red-700 mt-1">
                  {formatCurrency(data.monthExpenses)}
                </div>
              </div>
            </div>

            {/* Net cash flow */}
            <div
              className={`rounded-lg p-3 ${netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Net Cash Flow</span>
                <span
                  className={`text-lg font-bold ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </span>
              </div>
            </div>

            {/* By group */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Group</div>
              <div className="space-y-2">
                {data.categoryGroups.map((g) => (
                  <div key={g.group}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{g.group}</span>
                      <span className="font-medium">
                        <span className={g.actual > g.budgeted && g.budgeted > 0 ? 'text-red-600' : 'text-gray-800'}>
                          {formatCurrency(g.actual)}
                        </span>
                        {g.budgeted > 0 && (
                          <span className="text-gray-400 text-xs ml-1">/ {formatCurrency(g.budgeted)}</span>
                        )}
                      </span>
                    </div>
                    {g.budgeted > 0 && (
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${Math.min(100, (g.actual / g.budgeted) * 100)}%`,
                            backgroundColor: g.actual > g.budgeted ? '#dc2626' : '#2E6DA4',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Owner's Equity */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
              Owner&apos;s Equity
            </h2>
          </div>
          <div className="card-body space-y-4">
            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase">Savings Rate</div>
                <div
                  className="text-2xl font-bold mt-1"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: data.savingsRate >= 20 ? '#16a34a' : data.savingsRate >= 10 ? '#E8A020' : '#dc2626',
                  }}
                >
                  {formatPercent(data.savingsRate)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase">CC Debt</div>
                <div className="text-2xl font-bold text-red-600 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                  {formatCurrency(data.debtBalance)}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium uppercase">Investments</div>
              <div className="text-2xl font-bold text-blue-600 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                {formatCurrency(data.investmentBalance)}
              </div>
            </div>

            {/* Net worth trend chart */}
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                12-Month Net Worth
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.netWorthHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                    labelStyle={{ fontSize: 11 }}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#2E6DA4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual bar chart */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
            Budget vs. Actual — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.categoryGroups} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="group" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="budgeted" name="Budgeted" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#2E6DA4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  if (month === 12) return `${year + 1}-01-01`
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}
