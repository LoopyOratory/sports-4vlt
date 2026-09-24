/**
 * The single app database client (SQLite via bun:sqlite + Drizzle).
 *
 * Server-only. Import from server functions with a DYNAMIC import
 * (`await import('@/db')`) or from other `.server` modules — never statically
 * from a module reached by the client bundle (keeps bun:sqlite out of the
 * browser build; same rule the old db.server.ts followed).
 *
 * File: data/sports-4vlt.sqlite (fresh DB from the merge; the pre-merge
 * oddshub.sqlite held only 7-day-TTL votes/slips and is retired).
 */
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from './schema'

const dataDir = join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

const DB_PATH = process.env.SQLITE_PATH ?? join(dataDir, 'sports-4vlt.sqlite')

const sqlite = new Database(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
