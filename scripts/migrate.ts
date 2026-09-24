// Bun-native SQLite migration runner (drizzle-kit migrate is a Node tool and
// does not target the bun:sqlite driver).
// Usage: bun run db:migrate   (respects SQLITE_PATH, defaults to data/sports-4vlt.sqlite)
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from '@/db'

await migrate(db, { migrationsFolder: './src/db/migrations' })
console.log('[migrate] migrations applied')
process.exit(0)
