import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const { householdId, userId } = await requireHousehold()

    const [profiles, [household], accounts] = await Promise.all([
      sql`
        SELECT id, email, display_name, role FROM user_profiles
        WHERE household_id = ${householdId}
        ORDER BY created_at
      `,
      sql`SELECT id, name FROM households WHERE id = ${householdId}`,
      sql`
        SELECT id, name, institution, type, class, last_balance, last_updated, is_active
        FROM accounts WHERE household_id = ${householdId}
        ORDER BY institution, name
      `,
    ])

    const profile = (profiles as any[]).find((p) => p.id === userId)

    return NextResponse.json({ profile, household, members: profiles, accounts })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId, userId } = await requireHousehold()
    const body = await request.json()
    const { target, displayName, householdName } = body

    if (target === 'profile' && displayName) {
      await sql`
        UPDATE user_profiles SET display_name = ${displayName}
        WHERE id = ${userId}
      `
    } else if (target === 'household' && householdName) {
      await sql`
        UPDATE households SET name = ${householdName}
        WHERE id = ${householdId}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
