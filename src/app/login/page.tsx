'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('Enestvedt Household')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            household_name: householdName,
          },
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email to confirm your account, then sign in.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            CFO
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}
          >
            Household CFO
          </h1>
          <p className="text-gray-500 mt-1">Personal Finance Command Center</p>
        </div>

        {/* Form card */}
        <div className="card">
          <div className="card-header">
            <div className="flex gap-4">
              <button
                onClick={() => setMode('login')}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                  mode === 'login'
                    ? 'border-navy-700 text-navy-700'
                    : 'border-transparent text-gray-500'
                }`}
                style={mode === 'login' ? { borderColor: '#1E3A5F', color: '#1E3A5F' } : {}}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                  mode === 'signup'
                    ? 'border-navy-700 text-navy-700'
                    : 'border-transparent text-gray-500'
                }`}
                style={mode === 'signup' ? { borderColor: '#1E3A5F', color: '#1E3A5F' } : {}}
              >
                Create Account
              </button>
            </div>
          </div>

          <div className="card-body">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="form-label">Your Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="form-input"
                      placeholder="David Enestvedt"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Household Name</label>
                    <input
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      className="form-input"
                      placeholder="Enestvedt Household"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-white font-medium rounded-md transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#1E3A5F' }}
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Enestvedt Household · Private & Secure
        </p>
      </div>
    </div>
  )
}
