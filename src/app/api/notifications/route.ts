import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const unreadOnly = new URL(request.url).searchParams.get('unread') === 'true'

    const notifications = unreadOnly
      ? await sql`
          SELECT id, type, message, is_read, created_at, metadata
          FROM notifications
          WHERE household_id = ${householdId} AND is_read = false
          ORDER BY created_at DESC LIMIT 50
        `
      : await sql`
          SELECT id, type, message, is_read, created_at, metadata
          FROM notifications
          WHERE household_id = ${householdId}
          ORDER BY created_at DESC LIMIT 50
        `

    return NextResponse.json(notifications)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const { id, markAllRead } = await request.json()

    if (markAllRead) {
      await sql`
        UPDATE notifications SET is_read = true
        WHERE household_id = ${householdId} AND is_read = false
      `
    } else if (id) {
      await sql`
        UPDATE notifications SET is_read = true
        WHERE id = ${id} AND household_id = ${householdId}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
