/**
 * Parcours 6 — Déni de service par requête unique (BUG-01 / BUG-06).
 *
 * `POST /paie/heures-sup` avec un employé inexistant arrête le processus du
 * service : la TypeError remonte dans un handler async qu'Express 4
 * n'intercepte pas, et Node ≥ 15 sort en code 1 sur rejet non géré.
 *
 * Ce parcours démarre sa PROPRE instance sur le port 3102 : utiliser
 * l'instance partagée la tuerait et ferait échouer tous les parcours suivants.
 */
const { spawn } = require('child_process')
const path = require('path')
const { test, expect } = require('@playwright/test')

const PORT_ISOLE = 3102
const BASE = `http://127.0.0.1:${PORT_ISOLE}`
const racine = path.join(__dirname, '..', '..')

/** @type {import('child_process').ChildProcess} */
let service

/** @type {{code: number|null, signal: string|null}|null} */
let sortie = null

let stderrService = ''

async function attendreServicePret() {
  const timeout = Date.now() + 10000

  while (Date.now() < timeout) {
    if (sortie !== null) {
      throw new Error(
        `Le service paie isolé s'est arrêté avant d'être prêt. ` +
        `code=${sortie.code}, signal=${sortie.signal}\n${stderrService}`
      )
    }

    try {
      const reponse = await fetch(`${BASE}/health`)

      if (reponse.ok) {
        return
      }
    } catch (err) {
      // Le service est encore en cours de démarrage.
    }

    await new Promise((resoudre) => setTimeout(resoudre, 250))
  }

  throw new Error(
    `Le service paie isolé n'est pas devenu prêt sur le port ${PORT_ISOLE} ` +
    `dans le délai imparti.\n${stderrService}`
  )
}

test.beforeAll(async () => {
  sortie = null
  stderrService = ''

  service = spawn(
    process.execPath,
    ['services/paie/src/server.js'],
    {
      cwd: racine,
      env: {
        ...process.env,

        PAIE_PORT: String(PORT_ISOLE),

        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test',

        /*
         * Aucun appel Stripe externe pendant ce parcours E2E.
         * Le service paie doit fonctionner normalement sans secret Stripe.
         */
        STRIPE_SECRET_KEY: '',

        HTTP_PROXY: '',
        HTTPS_PROXY: '',
      },

      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  service.stderr.on('data', (data) => {
    stderrService += data.toString()
  })

  service.on('exit', (code, signal) => {
    sortie = {
      code,
      signal,
    }
  })

  await attendreServicePret()
})

test.afterAll(() => {
  if (service && sortie === null) {
    service.kill()
  }
})

test.describe.configure({
  mode: 'serial',
})
test.setTimeout(60000)

test.describe('Parcours 6 — Déni de service', () => {
  test('étape 1 — l’instance isolée du service paie répond normalement', async ({ request }) => {
    const reponse = await request.post(
      `${BASE}/paie/heures-sup`,
      {
        data: {
          employeeId: 1,
          heures: 8,
        },
      }
    )

    expect(reponse.status()).toBe(200)

    const corps = await reponse.json()

    expect(corps.total).toBeCloseTo(197.8, 1)

    expect(sortie).toBeNull()
  })

  test('étape 2 — une requête sans jeton avec un employé inexistant n’obtient aucune réponse', async ({ request }) => {
    let aRepondu = true

    try {
      /*
       * Aucun en-tête Authorization :
       * la route reste directement accessible.
       */
      await request.post(
        `${BASE}/paie/heures-sup`,
        {
          data: {
            employeeId: 999999,
            heures: 8,
          },

          timeout: 5000,
        }
      )
    } catch (err) {
      aRepondu = false

      expect(String(err)).toMatch(
        /timeout|socket hang up|ECONNRESET|ECONNREFUSED/i
      )
    }

    expect(aRepondu).toBe(false)
  })

  test('étape 3 — le processus du service s’est arrêté en erreur', async () => {
    await new Promise(
      (resoudre) => setTimeout(resoudre, 1000)
    )

    expect(sortie).not.toBeNull()
    expect(sortie.code).toBe(1)
  })

  test('étape 4 — le service est définitivement injoignable', async ({ request }) => {
    let injoignable = false

    try {
      await request.post(
        `${BASE}/paie/heures-sup`,
        {
          data: {
            employeeId: 1,
            heures: 8,
          },

          timeout: 3000,
        }
      )
    } catch (err) {
      injoignable = true

      expect(String(err)).toMatch(
        /ECONNREFUSED|socket hang up/i
      )
    }

    /*
     * Rien ne relance automatiquement le service :
     * il n'y a ni superviseur ni politique de redémarrage.
     */
    expect(injoignable).toBe(true)
  })
})