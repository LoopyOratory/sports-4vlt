// Seed the curated stream_map — the Ghana-first where-to-watch catalogue the
// links provider serves for every match. This file is the source of truth for
// curated rows (edit here, re-run: `bun run scripts/seed-stream-map.ts`).
import { db } from '@/db'
import { streamMap } from '@/db/schema'

const rows = [
  // Ghana Premier League
  { competition: 'ghana-premier-league', provider: 'tv3', label: 'TV3', kind: 'tv', country: 'GH', url: null, priority: 10, affiliate: false },
  { competition: 'ghana-premier-league', provider: 'onua', label: 'Onua TV', kind: 'tv', country: 'GH', url: null, priority: 11, affiliate: false },
  { competition: 'ghana-premier-league', provider: 'adesa-plus', label: 'Adesa+ (GFA platform)', kind: 'stream', country: 'GH', url: null, priority: 20, affiliate: false },
  { competition: 'ghana-premier-league', provider: 'supersport', label: 'SuperSport (DStv/GOtv)', kind: 'tv', country: 'GH', url: 'https://supersport.com', priority: 30, affiliate: false },
  // AFCON / CAF competitions
  { competition: 'afcon', provider: 'caf-tv', label: 'CAF TV (YouTube, free)', kind: 'stream', country: '*', url: 'https://www.youtube.com/channel/UCr5K057x3mHroPHsNk9OiwA', priority: 10, affiliate: false },
  { competition: 'afcon', provider: 'supersport', label: 'SuperSport (DStv/GOtv)', kind: 'tv', country: 'GH', url: 'https://supersport.com', priority: 20, affiliate: false },
  // Bookmaker streams (affiliate placeholders — swap for tracking links)
  { competition: '*', provider: 'sportytv', label: 'SportyTV (SportyBet app)', kind: 'bookmaker-stream', country: 'GH', url: 'https://www.sportybet.com/gh', priority: 50, affiliate: true },
  { competition: '*', provider: 'bet365', label: 'bet365 Live Stream', kind: 'bookmaker-stream', country: 'GH', url: 'https://www.bet365.com', priority: 51, affiliate: true },
  { competition: '*', provider: '1xbet', label: '1xBet Live Stream', kind: 'bookmaker-stream', country: 'GH', url: 'https://1xbet.com', priority: 52, affiliate: true },
]

db.delete(streamMap).run()
db.insert(streamMap)
  .values(rows.map((r) => ({ ...r, active: true })))
  .run()
console.log(`[seed] stream_map: ${rows.length} rows`)
process.exit(0)
