'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatPercent, formatMonthYear } from '@/lib/utils/format'
import Link from 'next/link'

interface MonthlyReview {
  id: string
  month: string
  notes: string | null
  is_locked: boolean
  completed_at: string | null
}

interface ReviewData {
  income: number
  expenses: number
  netWorth: number
  savingsRate: number
  debtBalance: number
  investmentBalance: number
  categoryBreakdown: Array<{ name: string; group: string; actual: number; budgeted: number }>
}

export default function ReviewsPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [review, setReview] = useState<MonthlyReview | null>(null)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviews, setReviews] = useState<MonthlyReview[]>([])
  const [weeklyStats, setWeeklyStats] = useState<{ spend: number; uncategorized: number; topCategories: any[] } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reviews?month=${selectedMonth}`)
    if (res.ok) {
      const d = await res.json()
      setReviews(d.reviews || [])
      setReview(d.review || null)
      setNotes(d.review?.notes || '')
      setReviewData(d.reviewData || null)
      setWeeklyStats(d.weeklyStats || null)
    }
    setLoading(false)
  }, [selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveNotes = async () => {
    setSaving(true)
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: selectedMonth, notes }),
    })
    setSaving(false)
    loadData()
  }

  const completeReview = async () => {
    setSaving(true)
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: selectedMonth, notes, complete: true }),
    })
    setSaving(false)
    loadData()
  }

  const archiveMonth = async () => {
    if (!review) return
    setSaving(true)
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: selectedMonth, archive: true }),
    })
    setSaving(false)
    loadData()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Weekly & monthly review workflows</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Review history */}
        <div className="col-span-1">
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                Review History
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {reviews.length === 0 && (
                <div className="p-4 text-sm text-gray-400">No reviews yet</div>
              )}
              {reviews.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedMonth(r.month)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedMonth === r.month ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-gray-800">{formatMonthYear(r.month)}</div>
                    {r.completed_at ? (
                      <span className="badge-green">Done</span>
                    ) : (
                      <span className="badge-amber">Pending</span>
                    )}
                  </div>
                  {r.is_locked && <div className="text-xs text-gray-400 mt-0.5">Archived</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Summary */}
          {weeklyStats && (
            <div className="card mt-4">
              <div className="card-header">
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                  This Week
                </h3>
              </div>
              <div className="card-body space-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">7-Day Spending</div>
                  <div className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>
                    {formatCurrency(weeklyStats.spend)}
                  </div>
                </div>
                {weeklyStats.uncategorized > 0 && (
                  <div className="p-2 bg-amber-50 rounded text-sm">
                    <span className="text-amber-700 font-medium">{weeklyStats.uncategorized} uncategorized</span>
                    <Link href="/transactions/review" className="ml-2 text-blue-600 text-xs hover:underline">Review →</Link>
                  </div>
                )}
                {weeklyStats.topCategories.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Top Categories</div>
                    {weeklyStats.topCategories.map((cat: any) => (
                      <div key={cat.name} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">{cat.name}</span>
                        <span className="font-medium text-gray-800">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Monthly review */}
        <div className="col-span-2">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <h3 className="font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
                  Monthly Review: {formatMonthYear(selectedMonth)}
                </h3>
                {review?.is_locked && <span className="badge-blue mt-1">Archived</span>}
              </div>
              <input
                type="month"
                value={selectedMonth.substring(0, 7)}
                onChange={(e) => setSelectedMonth(e.target.value + '-01')}
                className="form-input w-40"
              />
            </div>

            {loading ? (
              <div className="card-body text-gray-400">Loading...</div>
            ) : reviewData && (
              <div className="card-body space-y-6">
                {/* Income / Expense summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium">Income</div>
                    <div className="text-xl font-bold text-green-700 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                      {formatCurrency(reviewData.income)}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-600 font-medium">Expenses</div>
                    <div className="text-xl font-bold text-red-700 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                      {formatCurrency(reviewData.expenses)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-medium">Net Worth</div>
                    <div className="text-xl font-bold text-gray-800 mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                      {formatCurrency(reviewData.netWorth)}
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: reviewData.savingsRate >= 20 ? '#d1fae5' : reviewData.savingsRate >= 10 ? '#fef9c3' : '#fee2e2',
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: reviewData.savingsRate >= 20 ? '#065f46' : reviewData.savingsRate >= 10 ? '#713f12' : '#991b1b' }}>
                      Savings Rate
                    </div>
                    <div className="text-xl font-bold mt-1" style={{ fontFamily: 'Georgia, serif', color: reviewData.savingsRate >= 20 ? '#065f46' : reviewData.savingsRate >= 10 ? '#713f12' : '#991b1b' }}>
                      {formatPercent(reviewData.savingsRate)}
                    </div>
                  </div>
                </div>

                {/* Category breakdown */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Top Spending Categories</h4>
                  <div className="space-y-1">
                    {reviewData.categoryBreakdown.slice(0, 10).map((cat) => (
                      <div key={cat.name} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                          <span className="text-xs text-gray-400 ml-2">({cat.group})</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-semibold ${cat.actual > cat.budgeted && cat.budgeted > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {formatCurrency(cat.actual)}
                          </span>
                          {cat.budgeted > 0 && (
                            <span className="text-xs text-gray-400 ml-1">/ {formatCurrency(cat.budgeted)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="form-label">Month Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add commentary about this month... wins, challenges, adjustments needed..."
                    className="form-input min-h-24 resize-y"
                    disabled={review?.is_locked}
                  />
                </div>

                {/* Actions */}
                {!review?.is_locked && (
                  <div className="flex gap-3">
                    <button onClick={saveNotes} disabled={saving} className="btn-secondary">
                      Save Notes
                    </button>
                    <button onClick={completeReview} disabled={saving} className="btn-primary">
                      Mark Review Complete
                    </button>
                    {review?.completed_at && (
                      <button onClick={archiveMonth} disabled={saving} className="btn-secondary">
                        Archive Month
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
