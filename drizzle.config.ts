import { defineConfig } from 'drizzle-kit'

// SQLite (bun:sqlite) — the app database. Cache lives separately
// (src/lib/bsd-cache.server.ts, its own file). Authoring: `bun run db:generate`;
// applying: `bun run db:migrate` (Bun-native runner in scripts/migrate.ts —
// drizzle-kit migrate is a Node tool and does not target the bun driver).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
})
