import { sql } from './index'

interface UserContext {
  household_id: string
  role: string
}

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Paycheck', group_name: 'Income', type: 'Income', sort_order: 1 },
  { name: 'Interest', group_name: 'Income', type: 'Income', sort_order: 2 },
  // Living
  { name: 'Housing', group_name: 'Living', type: 'Expense', sort_order: 10 },
  { name: 'Groceries', group_name: 'Living', type: 'Expense', sort_order: 11 },
  { name: 'Utilities and Bills', group_name: 'Living', type: 'Expense', sort_order: 12 },
  { name: 'Transportation', group_name: 'Living', type: 'Expense', sort_order: 13 },
  { name: 'Insurance', group_name: 'Living', type: 'Expense', sort_order: 14 },
  { name: 'Medical and Dental', group_name: 'Living', type: 'Expense', sort_order: 15 },
  { name: 'Education', group_name: 'Living', type: 'Expense', sort_order: 16 },
  { name: 'Fitness', group_name: 'Living', type: 'Expense', sort_order: 17 },
  { name: 'Pets', group_name: 'Living', type: 'Expense', sort_order: 18 },
  { name: 'Kids', group_name: 'Living', type: 'Expense', sort_order: 19 },
  { name: 'Daycare', group_name: 'Living', type: 'Expense', sort_order: 20 },
  // Discretionary
  { name: 'Restaurants', group_name: 'Discretionary', type: 'Expense', sort_order: 30 },
  { name: 'Entertainment', group_name: 'Discretionary', type: 'Expense', sort_order: 31 },
  { name: 'Shopping', group_name: 'Discretionary', type: 'Expense', sort_order: 32 },
  { name: 'Travel', group_name: 'Discretionary', type: 'Expense', sort_order: 33 },
  { name: 'Subscriptions', group_name: 'Discretionary', type: 'Expense', sort_order: 34 },
  { name: 'Gifts', group_name: 'Discretionary', type: 'Expense', sort_order: 35 },
  { name: 'Home Improvement', group_name: 'Discretionary', type: 'Expense', sort_order: 36 },
  { name: 'Charity', group_name: 'Discretionary', type: 'Expense', sort_order: 37 },
  // Financial
  { name: 'Loan Repayment', group_name: 'Financial', type: 'Expense', sort_order: 40 },
  { name: 'Taxes', group_name: 'Financial', type: 'Expense', sort_order: 41 },
  { name: 'Bank Fees', group_name: 'Financial', type: 'Expense', sort_order: 42 },
  // Transfer
  { name: 'Transfer', group_name: 'Transfer', type: 'Transfer', sort_order: 50 },
  // Other
  { name: 'Misc', group_name: 'Other', type: 'Expense', sort_order: 60 },
  { name: 'Check', group_name: 'Other', type: 'Expense', sort_order: 61 },
]

async function seedCategories(householdId: string) {
  for (const cat of DEFAULT_CATEGORIES) {
    await sql`
      INSERT INTO categories (household_id, name, group_name, type, sort_order)
      VALUES (${householdId}, ${cat.name}, ${cat.group_name}, ${cat.type}, ${cat.sort_order})
      ON CONFLICT (household_id, name) DO NOTHING
    `
  }
}

/**
 * Gets the household context for the current Clerk user.
 * Creates a household, profile, and default categories on first login.
 */
export async function getUserContext(
  clerkUserId: string,
  email?: string
): Promise<UserContext> {
  const rows = await sql`
    SELECT household_id, role
    FROM user_profiles
    WHERE id = ${clerkUserId}
  `

  if (rows.length > 0) {
    return { household_id: rows[0].household_id, role: rows[0].role }
  }

  // First login — create household, profile, and seed categories
  const [household] = await sql`
    INSERT INTO households (name)
    VALUES ('My Household')
    RETURNING id
  `

  await sql`
    INSERT INTO user_profiles (id, household_id, email, display_name, role)
    VALUES (
      ${clerkUserId},
      ${household.id},
      ${email ?? ''},
      ${email ? email.split('@')[0] : 'User'},
      'owner'
    )
  `

  await seedCategories(household.id)

  return { household_id: household.id, role: 'owner' }
}
