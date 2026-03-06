import { NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const { householdId } = await requireHousehold()

    const [unreadRow] = await sql`
      SELECT COUNT(*) as count FROM notifications
      WHERE household_id = ${householdId} AND is_read = false
    `
    const [reviewRow] = await sql`
      SELECT COUNT(*) as count FROM transactions
      WHERE household_id = ${householdId} AND is_reviewed = false
    `

    return NextResponse.json({
      unread: Number(unreadRow.count),
      review: Number(reviewRow.count),
    })
  } catch {
    return NextResponse.json({ unread: 0, review: 0 })
  }
}
