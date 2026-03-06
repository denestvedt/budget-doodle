import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const { householdId } = await requireHousehold()
    const categories = await sql`
      SELECT id, name, group_name, type, is_hidden, sort_order
      FROM categories
      WHERE household_id = ${householdId}
      ORDER BY group_name, sort_order, name
    `
    return NextResponse.json(categories)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const { name, group_name, type } = await request.json()

    const [cat] = await sql`
      INSERT INTO categories (household_id, name, group_name, type)
      VALUES (${householdId}, ${name}, ${group_name}, ${type})
      RETURNING *
    `
    return NextResponse.json(cat)
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const body = await request.json()
    const { id, name, group_name, type, is_hidden } = body

    if (is_hidden !== undefined) {
      await sql`
        UPDATE categories SET is_hidden = ${is_hidden}
        WHERE id = ${id} AND household_id = ${householdId}
      `
    } else {
      await sql`
        UPDATE categories SET name = ${name}, group_name = ${group_name}, type = ${type}
        WHERE id = ${id} AND household_id = ${householdId}
      `
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
