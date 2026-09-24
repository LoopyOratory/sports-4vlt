/**
 * Community data access (votes + public accumulators) — now on the shared
 * Drizzle client (src/db) instead of a private bun:sqlite handle. Function
 * signatures and return shapes are unchanged for callers.
 *
 * Server-only: import dynamically (`await import('@/lib/db.server')`) from
 * server-function modules so bun:sqlite never reaches the client bundle.
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { matchVotes, publicAccumulators } from '@/db/schema'

// Vote functions
export function castVote(eventId: number, vote: string, userHash: string): boolean {
  if (vote !== 'home' && vote !== 'draw' && vote !== 'away') return false
  try {
    db.insert(matchVotes)
      .values({ eventId, vote, userHash })
      .onConflictDoUpdate({
        target: [matchVotes.eventId, matchVotes.userHash],
        set: { vote },
      })
      .run()
    return true
  } catch {
    return false
  }
}

export function getVoteSummary(eventId: number) {
  return db.get(sql`
    SELECT
      COUNT(*) as total_votes,
      COUNT(*) FILTER (WHERE vote = 'home') as home_votes,
      COUNT(*) FILTER (WHERE vote = 'draw') as draw_votes,
      COUNT(*) FILTER (WHERE vote = 'away') as away_votes
    FROM match_votes
    WHERE event_id = ${eventId}
  `) as {
    total_votes: number
    home_votes: number
    draw_votes: number
    away_votes: number
  }
}

export function getUserVote(eventId: number, userHash: string): string | null {
  const row = db
    .select({ vote: matchVotes.vote })
    .from(matchVotes)
    .where(and(eq(matchVotes.eventId, eventId), eq(matchVotes.userHash, userHash)))
    .get()
  return row?.vote ?? null
}

// Accumulator functions
export function createAccumulator(
  code: string,
  userName: string,
  selections: unknown[],
  totalOdds: number,
  stake: number,
  potentialReturn: number,
): boolean {
  try {
    db.insert(publicAccumulators)
      .values({
        code,
        userName,
        selections: JSON.stringify(selections),
        totalOdds,
        stake,
        potentialReturn,
      })
      .run()
    return true
  } catch {
    return false
  }
}

export function getAccumulator(code: string) {
  // Slip pages live for 7 days, then expire automatically
  const row = db.get(sql`
    SELECT * FROM public_accumulators
    WHERE code = ${code} AND created_at >= datetime('now', '-7 days')
  `) as Record<string, unknown> | undefined
  if (row) {
    // Increment views
    db.run(sql`UPDATE public_accumulators SET views = views + 1 WHERE code = ${code}`)
    return { ...row, selections: JSON.parse(row.selections as string) }
  }
  return null
}

export function listPublicAccas(limit = 20, offset = 0) {
  return db.all(sql`
    SELECT id, code, user_name, total_odds, stake, potential_return, status, views, copies, created_at
    FROM public_accumulators
    WHERE status = 'pending' AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)
}

export function getTopAccas(period: 'day' | 'week' | 'month' = 'week', limit = 10) {
  const interval = period === 'day' ? '1 day' : period === 'week' ? '7 days' : '30 days'
  return db.all(sql`
    SELECT id, code, user_name, total_odds, stake, potential_return, copies, created_at
    FROM public_accumulators
    WHERE created_at >= datetime('now', ${`-${interval}`})
    ORDER BY copies DESC, total_odds DESC
    LIMIT ${limit}
  `)
}

// Cleanup: delete slip pages older than 7 days (called on server startup)
export function cleanupExpiredAccas(): number {
  const result = db.run(sql`
    DELETE FROM public_accumulators
    WHERE created_at < datetime('now', '-7 days')
  `) as unknown as { changes?: number }
  return Number(result?.changes ?? 0)
}

export function copyAccumulator(code: string): boolean {
  const result = db
    .update(publicAccumulators)
    .set({ copies: sql`copies + 1` })
    .where(eq(publicAccumulators.code, code))
    .run() as unknown as { changes?: number }
  return Number(result?.changes ?? 0) > 0
}

export function generateAccaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'ODD-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
