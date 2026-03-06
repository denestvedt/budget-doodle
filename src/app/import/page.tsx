'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { parseCSV, type ParsedTransaction, type Institution } from '@/lib/csv/parsers'
import { formatCurrency, formatDate } from '@/lib/utils/format'

interface Account {
  id: string
  name: string
  institution: string
  type: string
}

interface ImportSummary {
  total: number
  inserted: number
  duplicates: number
  errors: number
}

const INSTITUTION_LABELS: Record<Institution, string> = {
  wells_fargo: 'Wells Fargo',
  chase: 'Chase',
  betterment: 'Betterment',
  unknown: 'Unknown / Generic',
}

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [creating, setCreating] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountInstitution, setNewAccountInstitution] = useState('')
  const [newAccountType, setNewAccountType] = useState<'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT'>('CHECKING')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ institution: Institution; transactions: ParsedTransaction[] } | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [endingBalance, setEndingBalance] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts')
    if (res.ok) {
      const d = await res.json()
      setAccounts(d.accounts || [])
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setSummary(null)
    setParsed(null)
    setParseErrors([])

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const result = parseCSV(text)
      setParsed({ institution: result.institution, transactions: result.transactions })
      setParseErrors(result.errors)
    }
    reader.readAsText(f)
  }

  const createAccount = async () => {
    if (!newAccountName || !newAccountInstitution) return
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAccountName,
        institution: newAccountInstitution,
        type: newAccountType,
        class: newAccountType === 'CREDIT' ? 'Liability' : 'Asset',
      }),
    })
    if (res.ok) {
      const { account } = await res.json()
      setAccounts((prev) => [...prev, account])
      setSelectedAccount(account.id)
      setCreating(false)
      setNewAccountName('')
      setNewAccountInstitution('')
    }
  }

  const runImport = async () => {
    if (!parsed || !selectedAccount) return
    setImporting(true)
    setSummary(null)

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: selectedAccount,
        transactions: parsed.transactions,
        endingBalance: endingBalance ? parseFloat(endingBalance) : undefined,
      }),
    })

    if (res.ok) {
      const result = await res.json()
      setSummary({
        total: parsed.transactions.length,
        inserted: result.inserted || 0,
        duplicates: result.duplicates || 0,
        errors: result.errors || 0,
      })
    }

    setImporting(false)
    setParsed(null)
    setFile(null)
    setEndingBalance('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
          Import Transactions
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload CSV exports from Wells Fargo, Chase, or Betterment</p>
      </div>

      {/* Import result */}
      {summary && (
        <div className="card mb-6 border-green-200" style={{ borderColor: '#86efac' }}>
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">✓</div>
              <h3 className="font-bold text-green-800">Import Complete</h3>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-gray-50 rounded p-3">
                <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
                <div className="text-xs text-gray-500">Total rows</div>
              </div>
              <div className="bg-green-50 rounded p-3">
                <div className="text-2xl font-bold text-green-700">{summary.inserted}</div>
                <div className="text-xs text-gray-500">New transactions</div>
              </div>
              <div className="bg-yellow-50 rounded p-3">
                <div className="text-2xl font-bold text-yellow-700">{summary.duplicates}</div>
                <div className="text-xs text-gray-500">Duplicates skipped</div>
              </div>
              <div className="bg-red-50 rounded p-3">
                <div className="text-2xl font-bold text-red-700">{summary.errors}</div>
                <div className="text-xs text-gray-500">Errors</div>
              </div>
            </div>
            {summary.inserted > 0 && (
              <div className="mt-3 text-sm text-gray-600">
                AI categorization is running in the background. Check the{' '}
                <a href="/transactions/review" className="text-blue-600 hover:underline">Review Queue</a>{' '}
                for any transactions that need attention.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Select account */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
            Step 1: Select Account
          </h2>
        </div>
        <div className="card-body">
          {!creating ? (
            <div className="flex gap-3">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="form-input flex-1"
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.institution} ({a.type})
                  </option>
                ))}
              </select>
              <button onClick={() => setCreating(true)} className="btn-secondary whitespace-nowrap">
                + New Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Account Name</label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g. WF Checking"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Institution</label>
                  <input
                    type="text"
                    value={newAccountInstitution}
                    onChange={(e) => setNewAccountInstitution(e.target.value)}
                    placeholder="e.g. Wells Fargo"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Account Type</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as any)}
                    className="form-input"
                  >
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CREDIT">Credit Card</option>
                    <option value="INVESTMENT">Investment</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createAccount} className="btn-primary">Create Account</button>
                <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Upload file */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
            Step 2: Upload CSV File
          </h2>
        </div>
        <div className="card-body">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-3xl mb-2">↑</div>
            <div className="text-sm font-medium text-gray-700">
              {file ? file.name : 'Click to upload or drag & drop'}
            </div>
            <div className="text-xs text-gray-400 mt-1">CSV files from Wells Fargo, Chase, or Betterment</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          {parseErrors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 rounded text-sm text-red-600">
              {parseErrors.join('; ')}
            </div>
          )}

          {parsed && (
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="badge-blue">{INSTITUTION_LABELS[parsed.institution]}</span>
                <span className="text-sm text-gray-600">
                  {parsed.transactions.length} transactions detected
                </span>
              </div>

              {/* Preview table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Description</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.transactions.slice(0, 10).map((tx, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-600">{formatDate(tx.date)}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-xs truncate">{tx.description}</td>
                        <td className={`px-3 py-2 text-right font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    ))}
                    {parsed.transactions.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={3} className="px-3 py-2 text-center text-gray-400">
                          + {parsed.transactions.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Account balance */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
            Step 3: Ending Balance (Optional)
          </h2>
        </div>
        <div className="card-body">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={endingBalance}
                onChange={(e) => setEndingBalance(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="form-input pl-7"
              />
            </div>
            <span className="text-sm text-gray-500">
              Set the current account balance (used for Balance Sheet)
            </span>
          </div>
        </div>
      </div>

      {/* Import button */}
      <button
        onClick={runImport}
        disabled={!parsed || !selectedAccount || importing}
        className="btn-primary w-full py-3 text-base justify-center"
      >
        {importing
          ? 'Importing & Categorizing...'
          : `Import ${parsed ? parsed.transactions.length : 0} Transactions`}
      </button>

      {/* Supported formats */}
      <div className="mt-6 card">
        <div className="card-header">
          <h3 className="font-semibold text-sm text-gray-700">Supported CSV Formats</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-800 mb-1">Wells Fargo</div>
              <div className="text-xs text-gray-500">No headers. Columns: Date, Amount, *, *, Description</div>
            </div>
            <div>
              <div className="font-medium text-gray-800 mb-1">Chase</div>
              <div className="text-xs text-gray-500">Headers: Transaction Date, Post Date, Description, Category, Type, Amount, Memo</div>
            </div>
            <div>
              <div className="font-medium text-gray-800 mb-1">Betterment</div>
              <div className="text-xs text-gray-500">Headers: Date, Activity/Description, Amount, Shares, Price</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
