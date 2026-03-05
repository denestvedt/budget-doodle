'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/transactions', label: 'Transactions', icon: '↕' },
  { href: '/transactions/review', label: 'Review Queue', icon: '⚑', badge: true },
  { href: '/import', label: 'Import CSV', icon: '↑' },
  { href: '/budget/monthly', label: 'Monthly Budget', icon: '◫' },
  { href: '/budget/yearly', label: 'Yearly Budget', icon: '▦' },
  { href: '/categories', label: 'Categories', icon: '⊞' },
  { href: '/financial-health', label: 'Financial Health', icon: '↗' },
  { href: '/reviews', label: 'Reviews', icon: '✓' },
  { href: '/notifications', label: 'Notifications', icon: '◉', badge: true },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<{ email?: string; display_name?: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name, email')
          .eq('id', session.user.id)
          .single()
        setUser(profile || { email: session.user.email })
      }
    }

    const getCounts = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)

      const { count: review } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('is_reviewed', false)

      setUnreadCount(unread || 0)
      setReviewCount(review || 0)
    }

    getUser()
    getCounts()
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className="flex flex-col w-64 min-h-screen"
        style={{ backgroundColor: '#1E3A5F' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-600" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#E8A020' }}>
            CFO
          </div>
          <div>
            <div className="text-white font-bold text-sm" style={{ fontFamily: 'Georgia, serif' }}>Household CFO</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Finance Command Center</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const hasBadge = item.badge && (
              (item.href === '/notifications' && unreadCount > 0) ||
              (item.href === '/transactions/review' && reviewCount > 0)
            )
            const badgeCount = item.href === '/notifications' ? unreadCount : reviewCount

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-white hover:bg-opacity-10 hover:text-white'
                }`}
                style={active ? { backgroundColor: '#2E6DA4' } : {}}
              >
                <span className="flex items-center gap-3">
                  <span className="text-base w-5 text-center opacity-70">{item.icon}</span>
                  {item.label}
                </span>
                {hasBadge && (
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
        </nav>

        {/* User info */}
        {user && (
          <div
            className="flex items-center gap-3 px-4 py-4 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#2E6DA4' }}
            >
              {(user.display_name || user.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user.display_name || user.email?.split('@')[0]}
              </div>
              <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
