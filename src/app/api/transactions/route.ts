import { NextRequest, NextResponse } from 'next/server'
import { requireHousehold } from '@/lib/db/auth'
import { sql } from '@/lib/db'

const PER_PAGE = 50

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const { searchParams } = new URL(request.url)

    const page = Number(searchParams.get('page') ?? 1)
    const search = searchParams.get('search') ?? ''
    const categoryId = searchParams.get('category') ?? ''
    const accountId = searchParams.get('account') ?? ''
    const month = searchParams.get('month') ?? ''

    const offset = (page - 1) * PER_PAGE

    // Build WHERE clauses
    let dateFilter = sql``
    if (month) {
      const [year, m] = month.split('-')
      const start = `${year}-${m}-01`
      const end =
        m === '12' ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(m) + 1).padStart(2, '0')}-01`
      dateFilter = sql`AND t.date >= ${start} AND t.date < ${end}`
    }

    const searchFilter = search ? sql`AND t.description ILIKE ${'%' + search + '%'}` : sql``
    const catFilter = categoryId ? sql`AND t.category_id = ${categoryId}` : sql``
    const acctFilter = accountId ? sql`AND t.account_id = ${accountId}` : sql``

    const [countRow] = await sql`
      SELECT COUNT(*) as total
      FROM transactions t
      WHERE t.household_id = ${householdId}
      ${dateFilter} ${searchFilter} ${catFilter} ${acctFilter}
    `

    const rows = await sql`
      SELECT
        t.id, t.date, t.description, t.amount, t.is_reviewed, t.is_transfer,
        t.category_id, t.ai_confidence,
        c.id as cat_id, c.name as cat_name, c.group_name as cat_group, c.type as cat_type,
        a.id as acct_id, a.name as acct_name, a.institution as acct_institution
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.household_id = ${householdId}
      ${dateFilter} ${searchFilter} ${catFilter} ${acctFilter}
      ORDER BY t.date DESC
      LIMIT ${PER_PAGE} OFFSET ${offset}
    `

    const transactions = rows.map((r: any) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount: Number(r.amount),
      is_reviewed: r.is_reviewed,
      is_transfer: r.is_transfer,
      category_id: r.category_id,
      ai_confidence: r.ai_confidence ? Number(r.ai_confidence) : null,
      categories: r.cat_id ? { id: r.cat_id, name: r.cat_name, group_name: r.cat_group, type: r.cat_type } : null,
      accounts: r.acct_id ? { id: r.acct_id, name: r.acct_name, institution: r.acct_institution } : null,
    }))

    return NextResponse.json({ transactions, total: Number(countRow.total) })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold()
    const body = await request.json()
    const { ids, categoryId } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    await sql`
      UPDATE transactions
      SET category_id = ${categoryId}, is_reviewed = true
      WHERE id = ANY(${ids}::uuid[]) AND household_id = ${householdId}
    `

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
