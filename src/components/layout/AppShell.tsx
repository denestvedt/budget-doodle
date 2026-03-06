'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, useClerk, SignedIn } from '@clerk/nextjs'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/transactions', label: 'Transactions', icon: '↕' },
  { href: '/transactions/review', label: 'Review Queue', icon: '⚑', badge: 'review' },
  { href: '/import', label: 'Import CSV', icon: '↑' },
  { href: '/budget/monthly', label: 'Monthly Budget', icon: '◫' },
  { href: '/budget/yearly', label: 'Yearly Budget', icon: '▦' },
  { href: '/categories', label: 'Categories', icon: '⊞' },
  { href: '/financial-health', label: 'Financial Health', icon: '↗' },
  { href: '/reviews', label: 'Reviews', icon: '✓' },
  { href: '/notifications', label: 'Notifications', icon: '◉', badge: 'unread' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [unreadCount, setUnreadCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetch('/api/shell-counts')
      .then((r) => r.json())
      .then((d) => {
        setUnreadCount(d.unread ?? 0)
        setReviewCount(d.review ?? 0)
      })
      .catch(() => {})
  }, [pathname, user])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Don't render the shell on auth pages
  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
  if (isAuthPage) return <>{children}</>

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 min-h-screen" style={{ backgroundColor: '#1E3A5F' }}>
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: '#E8A020' }}
          >
            CFO
          </div>
          <div>
            <div className="text-white font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>
              Household CFO
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Finance Command Center
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <SignedIn>
            {navItems.map((item) => {
              const active = isActive(item.href)
              const badgeCount =
                item.badge === 'unread'
                  ? unreadCount
                  : item.badge === 'review'
                  ? reviewCount
                  : 0

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-gray-300 hover:bg-white hover:bg-opacity-10 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: '#2E6DA4' } : {}}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-base w-5 text-center opacity-70">{item.icon}</span>
                    {item.label}
                  </span>
                  {badgeCount > 0 && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#E8A020', minWidth: '1.25rem', textAlign: 'center' }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </SignedIn>
        </nav>

        {/* User info */}
        <SignedIn>
          {user && (
            <div
              className="flex items-center gap-3 px-4 py-4 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#2E6DA4' }}
              >
                {(user.fullName || user.emailAddresses[0]?.emailAddress || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.fullName || user.emailAddresses[0]?.emailAddress?.split('@')[0]}
                </div>
                <button
                  onClick={() => signOut({ redirectUrl: '/sign-in' })}
                  className="text-xs hover:underline"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </SignedIn>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  )
}
