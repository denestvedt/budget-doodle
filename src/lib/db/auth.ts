import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserContext } from './context'

/**
 * Returns the authenticated user's household_id, or throws a 401 response.
 * Use this in every API route.
 */
export async function requireHousehold(): Promise<{ userId: string; householdId: string }> {
  const { userId } = auth()
  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress

  const { household_id } = await getUserContext(userId, email)
  return { userId, householdId: household_id }
}
