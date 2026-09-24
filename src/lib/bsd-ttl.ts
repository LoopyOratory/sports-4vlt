/**
 * BSD response TTLs in seconds (ported from the LiveBall cache policy,
 * 2026-09-24). 0 = permanent — once stored for a finished match, never refetch.
 * Callers that know a match's state should pick the *_LIVE / *_FINISHED pair
 * explicitly; `ttlForPath` is the live-first fallback for generic call sites.
 */
export const TTL = {
  // Events
  EVENT_LIST: 60,
  LIVE_EVENTS: 30,
  EVENT_DETAIL_LIVE: 30,
  EVENT_DETAIL_FINISHED: 3600,
  EVENT_STATS_LIVE: 30,
  EVENT_STATS_FINISHED: 0, // permanent
  EVENT_INCIDENTS_LIVE: 30,
  EVENT_INCIDENTS_FINISHED: 0, // permanent
  EVENT_LINEUPS_PRE: 300,
  EVENT_LINEUPS_POST: 0, // permanent
  EVENT_ODDS: 300,
  EVENT_ODDS_COMPARISON: 180,
  EVENT_PLAYER_STATS_LIVE: 30,
  EVENT_PLAYER_STATS_FINISHED: 0, // permanent
  EVENT_PREDICTION: 3600,
  EVENT_H2H: 86400,
  EVENT_METADATA: 86400,
  EVENT_BROADCASTS: 3600,
  EVENT_SOCIAL: 900,
  EVENT_POLYMARKET: 60,

  // Leagues
  LEAGUE_LIST: 86400,
  LEAGUE_DETAIL: 86400,
  LEAGUE_SEASON: 3600,
  LEAGUE_SEASONS: 86400,
  LEAGUE_STANDINGS: 300,
  LEAGUE_VENUES: 86400,

  // Teams
  TEAM_LIST: 3600,
  TEAM_DETAIL: 3600,
  TEAM_SQUAD: 3600,
  TEAM_FIXTURES: 300,
  TEAM_SOCIAL: 900,

  // Players
  PLAYER_LIST: 3600,
  PLAYER_DETAIL: 3600,
  PLAYER_STATS: 3600,
  PLAYER_CAREER: 86400,
  PLAYER_TRANSFERS: 86400,
  PLAYER_NATIONAL_TEAM: 86400,
  PLAYER_SOCIAL: 900,

  // Managers
  MANAGER_DETAIL: 3600,
  MANAGER_CAREER: 86400,
  MANAGER_MATCHES: 300,
  MANAGER_SOCIAL: 900,

  // Referees
  REFEREE_DETAIL: 86400,
  REFEREE_MATCHES: 300,

  // Predictions
  PREDICTION_LIST: 900,
  PREDICTION_DETAIL: 3600,

  // Odds
  ODDS_LIST: 300,
  BEST_ODDS: 300,

  // Bookmakers
  BOOKMAKER_LIST: 86400,

  // Broadcasts / TV
  BROADCASTS: 3600,
  TV_CHANNELS: 86400,

  // Venues
  VENUE_DETAIL: 86400,

  // Social
  SOCIAL: 900,

  // Tournaments (WC2026 archive / AFCON hub)
  WORLDCUP_SQUADS: 3600,
  WORLDCUP_SQUAD_DETAIL: 3600,
} as const

/** Sentinel expiry for ttl=0 rows (permanent). */
export const PERMANENT_EXPIRES_MS = Date.UTC(2099, 11, 31, 23, 59, 59)

/**
 * Path → TTL classifier (live-first defaults). Sub-resource checks run before
 * the generic family checks because e.g. /events/123/stats/ must not fall
 * through to the events default.
 */
export function ttlForPath(path: string): number {
  // Events — sub-resources first
  if (path.startsWith('/events/live/')) return TTL.LIVE_EVENTS
  if (path.includes('/odds/comparison/')) return TTL.EVENT_ODDS_COMPARISON
  if (path.includes('/stats/')) return TTL.EVENT_STATS_LIVE
  if (path.includes('/incidents/')) return TTL.EVENT_INCIDENTS_LIVE
  if (path.includes('/lineups/')) return TTL.EVENT_LINEUPS_PRE
  if (path.includes('/player-stats/')) return TTL.EVENT_PLAYER_STATS_LIVE
  if (path.includes('/polymarket/')) return TTL.EVENT_POLYMARKET
  if (path.includes('/prediction/')) return TTL.EVENT_PREDICTION
  if (path.includes('/h2h/')) return TTL.EVENT_H2H
  if (path.includes('/metadata/')) return TTL.EVENT_METADATA
  if (path.includes('/broadcasts/')) return TTL.EVENT_BROADCASTS
  if (path.includes('/social/')) return TTL.EVENT_SOCIAL
  if (path.startsWith('/events/')) return TTL.EVENT_LIST

  // Odds
  if (path.startsWith('/odds/')) return TTL.ODDS_LIST

  // Leagues
  if (path.startsWith('/leagues/')) {
    if (path.includes('/standings/')) return TTL.LEAGUE_STANDINGS
    if (path.includes('/venues/')) return TTL.LEAGUE_VENUES
    if (path.includes('/seasons/')) return TTL.LEAGUE_SEASONS
    if (path.includes('/season/')) return TTL.LEAGUE_SEASON
    return TTL.LEAGUE_LIST
  }

  // Teams / players / managers / referees
  if (path.startsWith('/teams/')) {
    if (path.includes('/fixtures/')) return TTL.TEAM_FIXTURES
    if (path.includes('/squad/')) return TTL.TEAM_SQUAD
    if (path.includes('/social/')) return TTL.TEAM_SOCIAL
    return TTL.TEAM_DETAIL
  }
  if (path.startsWith('/players/')) {
    if (path.includes('/stats/')) return TTL.PLAYER_STATS
    if (path.includes('/career/')) return TTL.PLAYER_CAREER
    if (path.includes('/transfers/')) return TTL.PLAYER_TRANSFERS
    if (path.includes('/national-team/')) return TTL.PLAYER_NATIONAL_TEAM
    if (path.includes('/social/')) return TTL.PLAYER_SOCIAL
    return TTL.PLAYER_DETAIL
  }
  if (path.startsWith('/managers/')) {
    if (path.includes('/matches/')) return TTL.MANAGER_MATCHES
    if (path.includes('/career/')) return TTL.MANAGER_CAREER
    if (path.includes('/social/')) return TTL.MANAGER_SOCIAL
    return TTL.MANAGER_DETAIL
  }
  if (path.startsWith('/referees/')) {
    if (path.includes('/matches/')) return TTL.REFEREE_MATCHES
    return TTL.REFEREE_DETAIL
  }

  // Predictions / bookmakers / tv / venues / tournaments
  if (path.startsWith('/predictions/')) return TTL.PREDICTION_LIST
  if (path.startsWith('/bookmakers/')) return TTL.BOOKMAKER_LIST
  if (path.startsWith('/tv-channels/')) return TTL.TV_CHANNELS
  if (path.startsWith('/venues/')) return TTL.VENUE_DETAIL
  if (path.startsWith('/social/')) return TTL.SOCIAL
  if (path.startsWith('/worldcup/')) return TTL.WORLDCUP_SQUADS

  return 600 // safe default: 10 min
}

/** ms epoch for a TTL in seconds (0 → permanent sentinel). */
export function ttlToExpiresMs(ttlSeconds: number): number {
  if (ttlSeconds <= 0) return PERMANENT_EXPIRES_MS
  return Date.now() + ttlSeconds * 1000
}
