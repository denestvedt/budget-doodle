'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  formatCurrency,
  formatPercent,
  getDayOfMonth,
  getTotalDaysInCurrentMonth,
} from '@/lib/utils/format'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'

interface DashboardData {
  assets: number
  liabilities: number
  netWorth: number
  accounts: Array<{ id: string; name: string; institution: string; type: string; class: string; last_balance: number; last_updated: string | null }>
  monthIncome: number
  monthExpenses: number
  categoryGroups: Array<{ group: string; budgeted: number; actual: number }>
  netWorthHistory: Array<{ month: string; netWorth: number }>
  savingsRate: number
  debtBalance: number
  investmentBalance: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="text-2xl font-bold text-gray-400" style={{ fontFamily: 'Georgia, serif' }}>
          Loading Dashboard...
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Financial Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Morning briefing · Day {dayOfMonth} of {totalDays}</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Net Worth hero */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2E6DA4 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium opacity-70 uppercase tracking-wide mb-1">Net Worth</div>
            <div className="text-5xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{formatCurrency(data.netWorth)}</div>
            <div className="flex gap-6 mt-3 text-sm opacity-80">
              <span>Assets: {formatCurrency(data.assets)}</span>
              <span>Liabilities: {formatCurrency(data.liabilities)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-70 mb-1">Savings Rate</div>
            <div className="text-3xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>{formatPercent(data.savingsRate)}</div>
            <div className="text-sm opacity-70 mt-1">this month</div>
          </div>
        </div>
      </div>

      {/* Three panels */}
      <div className="grid grid-cols-3 gap-6">
        {/* Balance Sheet */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>Balance Sheet</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assets</div>
              {data.accounts.filter((a) => a.class === 'Asset').map((a) => (
                <div key={a.id} className="flex justify-between items-center py-1">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.institution}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-600">{formatCurrency(a.last_balance)}</div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-sm font-semibold text-gray-700">Total Assets</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(data.assets)}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Liabilities</div>
              {data.accounts.filter((a) => a.class === 'Liability').map((a) => (
                <div key={a.id} className="flex justify-between items-center py-1">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.institution}</div>
                  </div>
                  <div className="text-sm font-semibold text-red-600">{formatCurrency(Math.abs(a.last_balance))}</div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-sm font-semibold text-gray-700">Total Liabilities</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(data.liabilities)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Income Statement */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>Income Statement</h2>
            <div className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium uppercase">Income</div>
                <div className="text-xl font-bold text-green-700 mt-1">{formatCurrency(data.monthIncome)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-xs text-red-600 font-medium uppercase">Expenses</div>
                <div className="text-xl font-bold text-red-700 mt-1">{formatCurrency(data.monthExpenses)}</div>
              </div>
            </div>
            <div className={`rounded-lg p-3 ${netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Net Cash Flow</span>
                <span className={`text-lg font-bold ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`} style={{ fontFamily: 'Georgia, serif' }}>
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">By Group</div>
              {data.categoryGroups.map((g) => (
                <div key={g.group} className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{g.group}</span>
                    <span className="font-medium">
                      <span className={g.actual > g.budgeted && g.budgeted > 0 ? 'text-red-600' : 'text-gray-800'}>{formatCurrency(g.actual)}</span>
                      {g.budgeted > 0 && <span className="text-gray-400 text-xs ml-1">/ {formatCurrency(g.budgeted)}</span>}
                    </span>
                  </div>
                  {g.budgeted > 0 && (
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${Math.min(100, (g.actual / g.budgeted) * 100)}%`, backgroundColor: g.actual > g.budgeted ? '#dc2626' : '#2E6DA4' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Owner's Equity */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>Owner&apos;s Equity</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase">Savings Rate</div>
                <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'Georgia, serif', color: data.savingsRate >= 20 ? '#16a34a' : data.savingsRate >= 10 ? '#E8A020' : '#dc2626' }}>
                  {formatPercent(data.savingsRate)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase">CC Debt</div>
                <div className="text-2xl font-bold text-red-600 mt-1" style={{ fontFamily: 'Georgia, serif' }}>{formatCurrency(data.debtBalance)}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium uppercase">Investments</div>
              <div className="text-2xl font-bold text-blue-600 mt-1" style={{ fontFamily: 'Georgia, serif' }}>{formatCurrency(data.investmentBalance)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">12-Month Net Worth</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data.netWorthHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Net Worth']} contentStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="netWorth" stroke="#2E6DA4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
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
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
