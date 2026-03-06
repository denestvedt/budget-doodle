'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  formatCurrency,
  formatPercent,
  formatShortMonth,
} from '@/lib/utils/format'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts'

interface MonthlyMetric {
  month: string
  label: string
  netWorth: number
  savingsRate: number
  debtBalance: number
  investmentBalance: number
  income: number
  expenses: number
}

export default function FinancialHealthPage() {
  const [metrics, setMetrics] = useState<MonthlyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [savingsTarget, setSavingsTarget] = useState(20)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/financial-health')
    if (res.ok) {
      const d = await res.json()
      setMetrics(d.metrics || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const latest = metrics[metrics.length - 1]
  const prev = metrics[metrics.length - 2]

  const netWorthChange = latest && prev ? latest.netWorth - prev.netWorth : 0
  const ytdChange = metrics.length > 0 ? (latest?.netWorth || 0) - (metrics[0]?.netWorth || 0) : 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
          Financial Health
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Long-term financial metrics — trailing 12 months</p>
      </div>

      {/* Summary metrics */}
      {latest && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="card-body">
              <div className="metric-label">Net Worth</div>
              <div className="metric-value mt-1" style={{ color: '#1E3A5F' }}>
                {formatCurrency(latest.netWorth)}
              </div>
              <div className={`text-sm mt-1 ${netWorthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netWorthChange >= 0 ? '+' : ''}{formatCurrency(netWorthChange)} MoM
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {ytdChange >= 0 ? '+' : ''}{formatCurrency(ytdChange)} YTD
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="metric-label">Savings Rate</div>
              <div
                className="metric-value mt-1"
                style={{
                  color: latest.savingsRate >= 20 ? '#16a34a' : latest.savingsRate >= 10 ? '#E8A020' : '#dc2626',
                }}
              >
                {formatPercent(latest.savingsRate)}
              </div>
              <div className="text-sm text-gray-400 mt-1">Target: {savingsTarget}%</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="metric-label">CC Debt</div>
              <div className="metric-value mt-1 text-red-600">
                {formatCurrency(latest.debtBalance)}
              </div>
              {prev && (
                <div className={`text-sm mt-1 ${latest.debtBalance < prev.debtBalance ? 'text-green-600' : 'text-red-600'}`}>
                  {latest.debtBalance < prev.debtBalance ? '↓' : '↑'}{' '}
                  {formatCurrency(Math.abs(latest.debtBalance - prev.debtBalance))} MoM
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="metric-label">Investments</div>
              <div className="metric-value mt-1" style={{ color: '#2E6DA4' }}>
                {formatCurrency(latest.investmentBalance)}
              </div>
              {prev && (
                <div className={`text-sm mt-1 ${latest.investmentBalance > prev.investmentBalance ? 'text-green-600' : 'text-red-600'}`}>
                  {latest.investmentBalance > prev.investmentBalance ? '+' : ''}{formatCurrency(latest.investmentBalance - prev.investmentBalance)} MoM
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading metrics...</div>
      ) : (
        <div className="space-y-6">
          {/* Net Worth Timeline */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
                Net Worth Timeline
              </h2>
              <span className="text-xs text-gray-400">Trailing 12 months</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={metrics}>
                  <defs>
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E6DA4" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2E6DA4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Net Worth']} contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="netWorth" stroke="#2E6DA4" strokeWidth={2} fill="url(#netWorthGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Savings Rate Chart */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
                Savings Rate
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Target %:</span>
                <input
                  type="number"
                  value={savingsTarget}
                  onChange={(e) => setSavingsTarget(Number(e.target.value))}
                  className="w-16 px-2 py-1 border rounded text-sm text-center"
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Savings Rate']} contentStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={savingsTarget}
                    stroke="#E8A020"
                    strokeDasharray="4 4"
                    label={{ value: `Target ${savingsTarget}%`, fontSize: 10, fill: '#E8A020', position: 'right' }}
                  />
                  <Line type="monotone" dataKey="savingsRate" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Debt Paydown & Investment Growth side by side */}
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header">
                <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
                  Debt Paydown Tracker
                </h2>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'CC Debt']} contentStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="debtBalance" stroke="#dc2626" strokeWidth={2} fill="url(#debtGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F', fontFamily: 'Georgia, serif' }}>
                  Investment Growth
                </h2>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2E6DA4" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2E6DA4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Investments']} contentStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="investmentBalance" stroke="#2E6DA4" strokeWidth={2} fill="url(#investGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
