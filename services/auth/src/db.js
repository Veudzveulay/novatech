const { Pool } = require('pg')
const fs = require('fs')

const requiredVariables = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
const missingVariables = requiredVariables.filter((name) => !process.env[name])

if (missingVariables.length > 0) {
  throw new Error(`Missing database configuration: ${missingVariables.join(', ')}`)
}

const port = Number.parseInt(process.env.DB_PORT, 10)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid database configuration: DB_PORT')
}

const ssl = process.env.DB_SSL === 'true'
  ? {
      ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8'),
      rejectUnauthorized: true,
    }
  : undefined

const pool = new Pool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
})

module.exports = { pool }
