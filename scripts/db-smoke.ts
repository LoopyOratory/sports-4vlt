// DB smoke — proves the votes/accas refactor onto Drizzle behaves at runtime.
//   bun run scripts/db-smoke.ts
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { castVote, copyAccumulator, createAccumulator, generateAccaCode, getAccumulator, getTopAccas, getVoteSummary, getUserVote, listPublicAccas } from '@/lib/db.server'

const EVENT = 999999
const USER = 'smoke-user-1'

db.run(sql`DELETE FROM match_votes WHERE event_id = ${EVENT}`) // clean slate — idempotent assertions

castVote(EVENT, 'home', USER)
castVote(EVENT, 'away', USER) // upsert — should flip the vote
const summary = getVoteSummary(EVENT)
const vote = getUserVote(EVENT, USER)
console.log('vote summary:', JSON.stringify(summary))
console.log('user vote after upsert:', vote)
if (vote !== 'away') throw new Error('upsert failed')
if (summary.total_votes !== 1) throw new Error(`expected 1 vote, got ${summary.total_votes}`)

const code = generateAccaCode()
const ok = createAccumulator(code, 'Smoke', [{ label: 'X' }], 3.5, 10, 35)
if (!ok) throw new Error('createAccumulator failed')
const acca = getAccumulator(code)
console.log('acca:', code, '→', acca ? 'readback ok' : 'MISSING')
if (!acca) throw new Error('getAccumulator failed')
copyAccumulator(code)
console.log('public pending accas:', listPublicAccas(5, 0).length, '| top:', getTopAccas('week', 5).length)

console.log('DB smoke OK')
process.exit(0)
