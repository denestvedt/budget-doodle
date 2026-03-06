'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import Link from 'next/link'

interface Transaction {
  id: string
  date: string
  description: string
  full_description: string | null
  amount: number
  category_id: string | null
  category_hint: string | null
  ai_confidence: number | null
  is_reviewed: boolean
  categories: { id: string; name: string; group_name: string } | null
  accounts: { id: string; name: string; institution: string } | null
}

interface Category {
  id: string
  name: string
  group_name: string
}

export default function ReviewQueuePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({})
  const [learnRule, setLearnRule] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [txRes, catsRes] = await Promise.all([
      fetch('/api/transactions/review'),
      fetch('/api/categories'),
    ])

    const txs: Transaction[] = txRes.ok ? (await txRes.json()).transactions || [] : []
    const cats: Category[] = catsRes.ok ? (await catsRes.json()).categories || [] : []

    setTransactions(txs)
    setCategories(cats)

    // Pre-populate category selections
    const initial: Record<string, string> = {}
    const initialLearn: Record<string, boolean> = {}
    for (const tx of txs) {
      if (tx.category_id) initial[tx.id] = tx.category_id
      initialLearn[tx.id] = true
    }
    setSelectedCategory(initial)
    setLearnRule(initialLearn)

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const confirmTransaction = async (txId: string) => {
    const categoryId = selectedCategory[txId]
    if (!categoryId) return

    setSaving(true)
    const tx = transactions.find((t) => t.id === txId)
    if (!tx) { setSaving(false); return }

    await fetch('/api/transactions/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId, categoryId, learnRule: learnRule[txId] !== false }),
    })

    setTransactions((prev) => prev.filter((t) => t.id !== txId))
    setSaving(false)
  }

  const confirmAll = async () => {
    setSaving(true)
    const toConfirm = transactions.filter((t) => selectedCategory[t.id])
    for (const tx of toConfirm) {
      await fetch('/api/transactions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: tx.id,
          categoryId: selectedCategory[tx.id],
          learnRule: learnRule[tx.id] !== false,
        }),
      })
    }
    loadData()
    setSaving(false)
  }

  const applyBulkCategory = async () => {
    if (!bulkCategory || selectedIds.size === 0) return
    setSelectedCategory((prev) => {
      const next = { ...prev }
      for (const id of selectedIds) next[id] = bulkCategory
      return next
    })
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.group_name]) acc[cat.group_name] = []
    acc[cat.group_name].push(cat)
    return acc
  }, {} as Record<string, Category[]>)

  const readyCount = transactions.filter((t) => selectedCategory[t.id]).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Review Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} transactions need review
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/transactions" className="btn-secondary">
            All Transactions
          </Link>
          {readyCount > 0 && (
            <button onClick={confirmAll} disabled={saving} className="btn-primary">
              Confirm All {readyCount} Ready
            </button>
          )}
        </div>
      </div>

      {/* Stats banner */}
      {transactions.length > 0 && (
        <div
          className="rounded-lg p-4 mb-6 flex gap-6"
          style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}
        >
          <div>
            <div className="text-xs font-medium text-amber-700 uppercase">Uncategorized</div>
            <div className="text-xl font-bold text-amber-800">
              {transactions.filter((t) => !t.category_id).length}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700 uppercase">Low Confidence</div>
            <div className="text-xl font-bold text-amber-800">
              {transactions.filter((t) => t.ai_confidence != null && t.ai_confidence < 0.85).length}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700 uppercase">Ready to Confirm</div>
            <div className="text-xl font-bold text-amber-800">{readyCount}</div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-4 mb-4 p-3 rounded-lg border"
          style={{ backgroundColor: '#f0f4f9', borderColor: '#2E6DA4' }}
        >
          <span className="text-sm font-medium" style={{ color: '#1E3A5F' }}>
            {selectedIds.size} selected
          </span>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="form-input w-48"
          >
            <option value="">Assign category...</option>
            {Object.entries(groupedCategories).map(([group, cats]) => (
              <optgroup key={group} label={group}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button onClick={applyBulkCategory} className="btn-primary py-1.5 text-xs">
            Apply to {selectedIds.size}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-secondary py-1.5 text-xs">
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">✓</div>
          <div className="text-lg font-bold text-gray-700 mb-2">All caught up!</div>
          <div className="text-sm text-gray-500 mb-4">No transactions need review right now.</div>
          <Link href="/import" className="btn-primary">Import more transactions</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className={`card transition-all ${
                selectedIds.has(tx.id) ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(tx.id)}
                    onChange={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(tx.id)) next.delete(tx.id)
                        else next.add(tx.id)
                        return next
                      })
                    }}
                    className="mt-1 rounded"
                  />

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-800">{tx.description}</div>
                        {tx.full_description && tx.full_description !== tx.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{tx.full_description}</div>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>{formatDate(tx.date)}</span>
                          <span>{tx.accounts?.name} · {tx.accounts?.institution}</span>
                          {tx.ai_confidence != null && (
                            <span
                              className="px-1.5 rounded"
                              style={{
                                backgroundColor: tx.ai_confidence >= 0.85 ? '#d1fae5' : '#fff3cd',
                                color: tx.ai_confidence >= 0.85 ? '#065f46' : '#856404',
                              }}
                            >
                              AI: {Math.round(tx.ai_confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        {tx.category_hint && (
                          <div className="text-xs text-blue-600 mt-1">AI suggested: {tx.category_hint}</div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div
                          className="text-xl font-bold"
                          style={{ fontFamily: 'Georgia, serif', color: tx.amount < 0 ? '#dc2626' : '#16a34a' }}
                        >
                          {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <select
                        value={selectedCategory[tx.id] || ''}
                        onChange={(e) => setSelectedCategory((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                        className="form-input py-1.5 text-sm flex-1 max-w-xs"
                      >
                        <option value="">Select category...</option>
                        {Object.entries(groupedCategories).map(([group, cats]) => (
                          <optgroup key={group} label={group}>
                            {cats.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={learnRule[tx.id] !== false}
                          onChange={(e) => setLearnRule((prev) => ({ ...prev, [tx.id]: e.target.checked }))}
                          className="rounded"
                        />
                        Learn rule
                      </label>

                      <button
                        onClick={() => confirmTransaction(tx.id)}
                        disabled={!selectedCategory[tx.id] || saving}
                        className="btn-primary py-1.5 text-xs"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
