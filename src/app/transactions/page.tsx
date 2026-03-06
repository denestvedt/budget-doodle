'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import Link from 'next/link'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  is_reviewed: boolean
  is_transfer: boolean
  category_id: string | null
  ai_confidence: number | null
  categories: { id: string; name: string; group_name: string; type: string } | null
  accounts: { id: string; name: string; institution: string } | null
}

interface Category {
  id: string
  name: string
  group_name: string
}

const ITEMS_PER_PAGE = 50

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)

    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    if (filterCategory) params.set('category', filterCategory)
    if (filterAccount) params.set('account', filterAccount)
    if (filterMonth) params.set('month', filterMonth)

    const [txRes, catsRes, acctRes] = await Promise.all([
      fetch(`/api/transactions?${params}`),
      fetch('/api/categories'),
      fetch('/api/accounts'),
    ])

    if (txRes.ok) {
      const d = await txRes.json()
      setTransactions(d.transactions || [])
      setTotal(d.total || 0)
    }
    if (catsRes.ok) {
      const d = await catsRes.json()
      setCategories(d.categories || [])
    }
    if (acctRes.ok) {
      const d = await acctRes.json()
      setAccounts(d.accounts || [])
    }

    setLoading(false)
  }, [search, filterCategory, filterAccount, filterMonth, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateCategory = async (txId: string, categoryId: string) => {
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [txId], categoryId }),
    })

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, category_id: categoryId, is_reviewed: true, categories: categories.find((c) => c.id === categoryId) as any || null }
          : t
      )
    )
    setEditingId(null)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  const applyBulkCategory = async () => {
    if (!bulkCategory || selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, categoryId: bulkCategory }),
    })
    setSelectedIds(new Set())
    setBulkCategory('')
    loadData()
  }

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.group_name]) acc[cat.group_name] = []
    acc[cat.group_name].push(cat)
    return acc
  }, {} as Record<string, Category[]>)

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Transactions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total transactions</p>
        </div>
        <div className="flex gap-3">
          <Link href="/transactions/review" className="btn-secondary">
            Review Queue
          </Link>
          <Link href="/import" className="btn-primary">
            Import CSV
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search transactions..."
                className="form-input"
              />
            </div>
            <div>
              <select
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
                className="form-input"
              >
                <option value="">All months</option>
                {getLast12MonthOptions().map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
                className="form-input"
              >
                <option value="">All categories</option>
                {Object.entries(groupedCategories).map(([group, cats]) => (
                  <optgroup key={group} label={group}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filterAccount}
                onChange={(e) => { setFilterAccount(e.target.value); setPage(1) }}
                className="form-input"
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

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
            Apply to {selectedIds.size} transactions
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-secondary py-1.5 text-xs">
            Clear selection
          </button>
        </div>
      )}

      {/* Transactions table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onChange={selectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No transactions found. <Link href="/import" className="text-blue-600 hover:underline">Import a CSV</Link> to get started.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedIds.has(tx.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 max-w-xs truncate">{tx.description}</div>
                    {tx.is_transfer && <span className="text-xs text-blue-500">Transfer</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {tx.accounts?.name}
                    <div className="text-gray-400">{tx.accounts?.institution}</div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tx.id ? (
                      <select
                        autoFocus
                        defaultValue={tx.category_id || ''}
                        onChange={(e) => updateCategory(tx.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        className="form-input py-1 text-xs w-40"
                      >
                        <option value="">Uncategorized</option>
                        {Object.entries(groupedCategories).map(([group, cats]) => (
                          <optgroup key={group} label={group}>
                            {cats.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingId(tx.id)}
                        className="text-left hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                      >
                        {tx.categories ? (
                          <span>
                            <span className="text-gray-800">{tx.categories.name}</span>
                            <span className="text-gray-400 text-xs ml-1">({tx.categories.group_name})</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Uncategorized</span>
                        )}
                        {tx.ai_confidence != null && tx.ai_confidence < 0.85 && !tx.is_reviewed && (
                          <span
                            className="ml-1 text-xs px-1 rounded"
                            style={{ backgroundColor: '#fff3cd', color: '#856404' }}
                          >
                            {Math.round(tx.ai_confidence * 100)}%
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    <span className={tx.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                      {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.is_reviewed ? (
                      <span className="badge-green">Reviewed</span>
                    ) : !tx.category_id ? (
                      <span className="badge-amber">Needs Review</span>
                    ) : (
                      <span className="badge-blue">Auto</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getLast12MonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}
