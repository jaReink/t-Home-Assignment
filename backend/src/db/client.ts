import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import fs from 'fs'
import path from 'path'
import { config } from '../config.js'
import type { DB } from './types.js'

let db: Kysely<DB> | null = null

export function getDb(): Kysely<DB> {
  if (db) return db

  const dbPath = config.DB_PATH
  const dir = path.dirname(path.resolve(dbPath))
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  sqlite.exec(schema)

  db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
  })

  return db
}
