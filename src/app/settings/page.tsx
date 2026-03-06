'use client'

import { useState, useEffect, useCallback } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  email: string
  display_name: string | null
  role: string
}

interface Household {
  id: string
  name: string
}

interface Account {
  id: string
  name: string
  institution: string
  type: string
  class: string
  last_balance: number
  last_updated: string | null
  is_active: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const { signOut } = useClerk()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<UserProfile[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingAccount, setEditingAccount] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: '', institution: '', type: 'CHECKING', class: 'Asset', last_balance: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/settings')
    if (res.ok) {
      const d = await res.json()
      setProfile(d.profile || null)
      setDisplayName(d.profile?.display_name || '')
      setHousehold(d.household || null)
      setHouseholdName(d.household?.name || '')
      setMembers(d.members || [])
      setAccounts(d.accounts || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveProfile = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })
    setMessage('Profile saved.')
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const saveHousehold = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdName }),
    })
    setMessage('Household name saved.')
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/sign-in')
  }

  const saveAccount = async (accountId: string) => {
    setSaving(true)
    const balance = parseFloat(accountForm.last_balance) || 0
    await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: accountId,
        name: accountForm.name,
        institution: accountForm.institution,
        type: accountForm.type,
        class: accountForm.class,
        last_balance: balance,
      }),
    })
    setEditingAccount(null)
    setSaving(false)
    loadData()
  }

  const addAccount = async () => {
    setSaving(true)
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: accountForm.name,
        institution: accountForm.institution,
        type: accountForm.type,
        class: accountForm.type === 'CREDIT' ? 'Liability' : 'Asset',
        last_balance: parseFloat(accountForm.last_balance) || 0,
      }),
    })
    setAccountForm({ name: '', institution: '', type: 'CHECKING', class: 'Asset', last_balance: '' })
    setSaving(false)
    loadData()
  }

  const toggleAccountActive = async (id: string, current: boolean) => {
    await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a)))
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
          Settings
        </h1>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                Your Profile
              </h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="form-input bg-gray-50"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveProfile} disabled={saving} className="btn-primary">
                  Save Profile
                </button>
                <button onClick={handleSignOut} className="btn-danger">
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Household */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                Household
              </h2>
            </div>
            <div className="card-body space-y-4">
              <div className="max-w-sm">
                <label className="form-label">Household Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    className="form-input flex-1"
                  />
                  <button onClick={saveHousehold} disabled={saving} className="btn-primary">Save</button>
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Members</div>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div>
                        <div className="text-sm font-medium text-gray-800">
                          {member.display_name || member.email}
                        </div>
                        <div className="text-xs text-gray-400">{member.email}</div>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: member.role === 'owner' ? '#dbeafe' : '#f3f4f6',
                          color: member.role === 'owner' ? '#1e40af' : '#6b7280',
                        }}
                      >
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Invite Family Member</div>
                <div className="flex gap-2 max-w-sm">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="form-input flex-1"
                  />
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setMessage('Invite feature requires email configuration. Coming soon.')
                      setInviteEmail('')
                      setTimeout(() => setMessage(''), 3000)
                    }}
                  >
                    Invite
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-1">They&apos;ll receive full household access</div>
              </div>
            </div>
          </div>

          {/* Accounts */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                Financial Accounts
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {accounts.map((acct) => (
                <div key={acct.id} className={`px-4 py-3 ${!acct.is_active ? 'opacity-50' : ''}`}>
                  {editingAccount === acct.id ? (
                    <div className="grid grid-cols-5 gap-2">
                      <input type="text" value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="form-input py-1 text-sm" />
                      <input type="text" value={accountForm.institution} onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))} placeholder="Institution" className="form-input py-1 text-sm" />
                      <select value={accountForm.type} onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))} className="form-input py-1 text-sm">
                        <option value="CHECKING">Checking</option>
                        <option value="SAVINGS">Savings</option>
                        <option value="CREDIT">Credit</option>
                        <option value="INVESTMENT">Investment</option>
                      </select>
                      <input type="number" value={accountForm.last_balance} onChange={(e) => setAccountForm((f) => ({ ...f, last_balance: e.target.value }))} placeholder="Balance" className="form-input py-1 text-sm" step="0.01" />
                      <div className="flex gap-1">
                        <button onClick={() => saveAccount(acct.id)} className="btn-primary py-1 text-xs">Save</button>
                        <button onClick={() => setEditingAccount(null)} className="btn-secondary py-1 text-xs">×</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-gray-800">{acct.name}</div>
                        <div className="text-xs text-gray-400">{acct.institution} · {acct.type}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`text-sm font-semibold ${acct.class === 'Liability' ? 'text-red-600' : 'text-green-600'}`}>
                          ${Math.abs(acct.last_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => {
                              setEditingAccount(acct.id)
                              setAccountForm({
                                name: acct.name,
                                institution: acct.institution,
                                type: acct.type,
                                class: acct.class,
                                last_balance: String(acct.last_balance),
                              })
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button onClick={() => toggleAccountActive(acct.id, acct.is_active)} className="text-gray-400 hover:text-gray-600">
                            {acct.is_active ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new account */}
              <div className="px-4 py-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Add Account</div>
                <div className="grid grid-cols-5 gap-2">
                  <input type="text" value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="form-input py-1 text-sm" />
                  <input type="text" value={accountForm.institution} onChange={(e) => setAccountForm((f) => ({ ...f, institution: e.target.value }))} placeholder="Institution" className="form-input py-1 text-sm" />
                  <select value={accountForm.type} onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))} className="form-input py-1 text-sm">
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CREDIT">Credit</option>
                    <option value="INVESTMENT">Investment</option>
                  </select>
                  <input type="number" value={accountForm.last_balance} onChange={(e) => setAccountForm((f) => ({ ...f, last_balance: e.target.value }))} placeholder="Balance" className="form-input py-1 text-sm" step="0.01" />
                  <button onClick={addAccount} disabled={saving || !accountForm.name} className="btn-primary py-1 text-xs">
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
