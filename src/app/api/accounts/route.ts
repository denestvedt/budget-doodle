import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const { householdId } = await requireHousehold()
    const accounts = await sql`
      SELECT id, name, institution, type, class, last_balance, last_updated, is_active
      FROM accounts
      WHERE household_id = ${householdId}
      ORDER BY institution, name
    `
    return NextResponse.json(accounts)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const body = await request.json()
    const { name, institution, type, last_balance } = body
    const accountClass = type === 'CREDIT' ? 'Liability' : 'Asset'

    const [account] = await sql`
      INSERT INTO accounts (household_id, name, institution, type, class, last_balance)
      VALUES (${householdId}, ${name}, ${institution}, ${type}, ${accountClass}, ${last_balance ?? 0})
      RETURNING *
    `
    return NextResponse.json(account)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const body = await request.json()
    const { id, name, institution, type, class: accountClass, last_balance, is_active } = body

    if (is_active !== undefined) {
      await sql`
        UPDATE accounts SET is_active = ${is_active}
        WHERE id = ${id} AND household_id = ${householdId}
      `
    } else {
      await sql`
        UPDATE accounts
        SET name = ${name}, institution = ${institution}, type = ${type},
            class = ${accountClass}, last_balance = ${last_balance ?? 0},
            last_updated = NOW()
        WHERE id = ${id} AND household_id = ${householdId}
      `
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
