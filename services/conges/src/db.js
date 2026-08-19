const { Pool } = require('pg')
const fs = require('fs')

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
  const missingVariables = requiredVariables.filter((name) => !process.env[name])

  if (missingVariables.length > 0) {
    throw new Error(`Missing database configuration: ${missingVariables.join(', ')}`)
  }

  const port = Number.parseInt(process.env.DB_PORT, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid database configuration: DB_PORT')
  }

  const user = encodeURIComponent(process.env.DB_USER)
  const password = encodeURIComponent(process.env.DB_PASSWORD)
  const database = encodeURIComponent(process.env.DB_NAME)

  return `postgresql://${user}:${password}@${process.env.DB_HOST}:${port}/${database}`
}

const ssl = process.env.DB_SSL === 'true'
  ? {
      ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8'),
      rejectUnauthorized: true,
    }
  : undefined

const pool = new Pool({ connectionString: resolveDatabaseUrl(), ssl })

module.exports = { pool }
