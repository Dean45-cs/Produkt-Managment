import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isUnlocked, getSessionToken, dbFileExists } from '@/lib/vault'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieValue = cookies().get(SESSION_COOKIE)?.value
  const token = verifySession(cookieValue)
  const unlocked = isUnlocked() && !!token && token === getSessionToken()
  return NextResponse.json({ unlocked, firstRun: !dbFileExists() })
}
