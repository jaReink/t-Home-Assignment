import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // Prevents config.ts from calling process.exit(1) in test workers.
      // DB_PATH=:memory: makes getDb() create a fresh in-memory SQLite (with the
      // real schema) instead of touching the data/ directory.
      GITHUB_TOKEN: 'ghp_test',
      DB_PATH: ':memory:',
    },
  },
})
