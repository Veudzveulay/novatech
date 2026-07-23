/**
 * Applique db/schema.sql une fois par exécution. Échoue explicitement si
 * aucun PostgreSQL n'est joignable : un test d'intégration qui « passe » sans
 * base ne prouve rien.
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const CONNECTION =
  process.env.TEST_DATABASE_URL ||
  'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test'

module.exports = async () => {
  const client = new Client({ connectionString: CONNECTION })
  try {
    await client.connect()
  } catch (err) {
    throw new Error(
      `Impossible de joindre la base de test (${CONNECTION}).\n` +
      `Lance d'abord : npm run db:test:up\n` +
      `Erreur d'origine : ${err.message}`
    )
  }
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8')
  await client.query(schema)
  await client.end()
}
