'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  metadata: Record<string, any> | null
}

const TYPE_ICONS: Record<string, string> = {
  category_overspend: '⚠',
  mid_month_pace_warning: '↑',
  uncategorized_backlog: '⚑',
  weekly_review_reminder: '◎',
  monthly_review_reminder: '◎',
}

const TYPE_COLORS: Record<string, string> = {
  category_overspend: 'bg-red-50 border-red-200',
  mid_month_pace_warning: 'bg-amber-50 border-amber-200',
  uncategorized_backlog: 'bg-amber-50 border-amber-200',
  weekly_review_reminder: 'bg-blue-50 border-blue-200',
  monthly_review_reminder: 'bg-blue-50 border-blue-200',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    const params = filter === 'unread' ? '?unread=true' : ''
    const res = await fetch(`/api/notifications${params}`)
    if (res.ok) {
      const d = await res.json()
      setNotifications(d.notifications || [])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${filter === 'unread' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={filter === 'unread' ? { backgroundColor: '#1E3A5F' } : {}}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${filter === 'all' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={filter === 'all' ? { backgroundColor: '#1E3A5F' } : {}}
            >
              All
            </button>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-xs">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">◉</div>
          <div className="text-lg font-bold text-gray-700 mb-2">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          </div>
          <div className="text-sm text-gray-500">
            You&apos;ll be notified about budget overspends, pace warnings, and review reminders.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`card border ${TYPE_COLORS[notif.type] || 'bg-gray-50 border-gray-200'} ${
                notif.is_read ? 'opacity-60' : ''
              }`}
            >
              <div className="card-body flex items-start gap-3">
                <div className="text-xl w-6 text-center flex-shrink-0">
                  {TYPE_ICONS[notif.type] || '◉'}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{notif.message}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(notif.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {notif.type === 'uncategorized_backlog' && (
                    <Link href="/transactions/review" className="text-xs text-blue-600 hover:underline">
                      Review →
                    </Link>
                  )}
                  {(notif.type === 'weekly_review_reminder' || notif.type === 'monthly_review_reminder') && (
                    <Link href="/reviews" className="text-xs text-blue-600 hover:underline">
                      Open →
                    </Link>
                  )}
                  {!notif.is_read && (
                    <button
                      onClick={() => markRead(notif.id)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
