/**
 * App database schema (SQLite via bun:sqlite + Drizzle).
 *
 * Merge note (2026-09-24): `match_votes` + `public_accumulators` mirror the
 * tables the app created with raw SQL before the merge — same names, same
 * columns — so UI code and server functions keep working unchanged. The
 * watch-layer tables (stream_map / stream_cache / affiliate_clicks) are new:
 * they power the streaming-provider framework and the "watch" surfaces.
 */
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ── Community: match votes ──────────────────────────────────────────────────
export const matchVotes = sqliteTable(
  'match_votes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id').notNull(),
    // 'home' | 'draw' | 'away' — validated in castVote()
    vote: text('vote').notNull(),
    userHash: text('user_hash').notNull(),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex('uq_votes_event_user').on(t.eventId, t.userHash),
    index('idx_votes_event').on(t.eventId),
    index('idx_votes_user').on(t.userHash),
  ],
)

// ── Community: public accumulators (shareable slip pages, 7-day TTL) ────────
export const publicAccumulators = sqliteTable(
  'public_accumulators',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    userName: text('user_name').notNull(),
    selections: text('selections').notNull(), // JSON array
    totalOdds: real('total_odds').notNull(),
    stake: real('stake').default(10),
    potentialReturn: real('potential_return').notNull(),
    // 'pending' | 'won' | 'lost' | 'void'
    status: text('status').default('pending'),
    views: integer('views').default(0),
    copies: integer('copies').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex('uq_accas_code').on(t.code),
    index('idx_accas_status').on(t.status, t.createdAt),
    index('idx_accas_created').on(t.createdAt),
  ],
)

// ── Watch layer: curated where-to-watch map ─────────────────────────────────
// One row per (competition, provider). Resolved per match alongside BSD
// broadcasts; deep links only for broadcasters/bookmakers, embeds only for
// providers whose terms allow it (see src/server/watch/).
export const streamMap = sqliteTable(
  'stream_map',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // competition slug: 'ghana-premier-league' | 'afcon' | 'uefa-champions-league' | '*' (catch-all)
    competition: text('competition').notNull(),
    // stable provider id: 'tv3' | 'onua' | 'adesa-plus' | 'supersport' | 'caf-tv' | 'sportytv' | ...
    provider: text('provider').notNull(),
    label: text('label').notNull(),
    // 'tv' | 'stream' | 'bookmaker-stream' | 'radio'
    kind: text('kind').notNull(),
    country: text('country').default('GH'),
    url: text('url'),
    priority: integer('priority').default(100),
    affiliate: integer('affiliate', { mode: 'boolean' }).default(false),
    active: integer('active', { mode: 'boolean' }).default(true),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (t) => [index('idx_stream_map_comp').on(t.competition, t.active)],
)

// ── Watch layer: provider response cache (L2; providers keep a small L1) ────
export const streamCache = sqliteTable('stream_cache', {
  key: text('key').primaryKey(), // e.g. 'youtube:caf-tv:live' | 'scorebat:free-feed'
  provider: text('provider').notNull(),
  payload: text('payload').notNull(), // JSON
  expiresAt: integer('expires_at').notNull(),
})

// ── Monetization: outbound click tracking (affiliate attribution) ───────────
export const affiliateClicks = sqliteTable(
  'affiliate_clicks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: integer('event_id'),
    provider: text('provider').notNull(),
    targetUrl: text('target_url').notNull(),
    userHash: text('user_hash'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [index('idx_clicks_provider').on(t.provider, t.createdAt)],
)
