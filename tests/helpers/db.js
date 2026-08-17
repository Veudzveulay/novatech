/**
 * `resetDatabase()` rejoue db/seed-test.sql, qui commence par un TRUNCATE
 * RESTART IDENTITY : chaque test part du même état, quel que soit l'ordre.
 */
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const CONNECTION =
  process.env.TEST_DATABASE_URL ||
  'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test'

const seedSql = fs.readFileSync(
  path.join(__dirname, '..', '..', 'db', 'seed-test.sql'),
  'utf8'
)

const pool = new Pool({ connectionString: CONNECTION })

async function resetDatabase() {
  await pool.query(seedSql)
}

async function query(text, params) {
  return pool.query(text, params)
}

async function closePool() {
  await pool.end()
}

module.exports = { resetDatabase, query, closePool, CONNECTION }
