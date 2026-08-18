/**
 * Global setup Playwright : prépare la base avant de démarrer les services.
 *
 * Applique db/schema.sql puis db/seed-test.sql. Si la base n'est pas joignable,
 * on échoue immédiatement avec un message actionnable plutôt que de laisser les
 * 5 parcours tomber un par un sur des erreurs de connexion illisibles.
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const CONNECTION =
  process.env.TEST_DATABASE_URL ||
  'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test'

const racine = path.join(__dirname, '..', '..')

module.exports = async () => {
  const client = new Client({ connectionString: CONNECTION })
  try {
    await client.connect()
  } catch (err) {
    throw new Error(
      `E2E : base de test injoignable (${CONNECTION}).\n` +
      `Lance d'abord : npm run db:test:up\n` +
      `Erreur d'origine : ${err.message}`
    )
  }

  await client.query(fs.readFileSync(path.join(racine, 'db', 'schema.sql'), 'utf8'))
  await client.query(fs.readFileSync(path.join(racine, 'db', 'seed-test.sql'), 'utf8'))
  await client.end()

  fs.mkdirSync(path.join(racine, '.e2e-uploads'), { recursive: true })
}
