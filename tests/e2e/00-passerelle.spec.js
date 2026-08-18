/**
 * Parcours 0 — L'API Gateway ne route rien (BUG-12).
 *
 * `app.use('/api/auth', createProxyMiddleware({ target }))` transmet le chemin
 * d'origine sans retirer le préfixe de montage : le service auth reçoit
 * `/api/auth/login` alors que sa route est `/auth/login`. Aucun service
 * n'expose de route sous `/api/`, et nginx ne réécrit rien en amont.
 *
 * Correctif (remédiation) : `pathRewrite: { '^/api': '' }` sur chaque proxy.
 */
const { test, expect } = require('@playwright/test')
const { GATEWAY, AUTH, PAIE, CONGES, RECRUTEMENT } = require('./cibles')

test.describe('Parcours 0 — Routage de la passerelle', () => {
  test('la passerelle est bien démarrée et répond sur /health', async ({ request }) => {
    const reponse = await request.get(`${GATEWAY}/health`)

    expect(reponse.status()).toBe(200)
    expect(await reponse.json()).toEqual({ status: 'ok' })
  })

  test('BUG-12 : une connexion valide échoue en 404 à travers la passerelle', async ({ request }) => {
    const parLaPasserelle = await request.post(`${GATEWAY}/api/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })
    expect(parLaPasserelle.status()).toBe(404)

    // Exactement la même requête, adressée directement au service : 200.
    const enDirect = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })
    expect(enDirect.status()).toBe(200)
    expect((await enDirect.json()).token).toBeTruthy()
  })

  test('BUG-12 : les 4 services sont injoignables par la passerelle', async ({ request }) => {
    const appels = [
      ['/api/auth/verify', 'POST'],
      ['/api/paie/calculer', 'POST'],
      ['/api/conges/solde/1', 'GET'],
      ['/api/recrutement/candidats', 'GET'],
    ]

    for (const [chemin, methode] of appels) {
      const reponse =
        methode === 'GET'
          ? await request.get(`${GATEWAY}${chemin}`)
          : await request.post(`${GATEWAY}${chemin}`, { data: {} })

      expect(reponse.status(), `${methode} ${chemin}`).toBe(404)
    }
  })

  test('BUG-12 : les mêmes routes répondent quand on s’adresse au service', async ({ request }) => {
    expect((await request.get(`${CONGES}/conges/solde/1`)).status()).toBe(200)
    expect((await request.get(`${RECRUTEMENT}/recrutement/candidats`)).status()).toBe(200)
    expect(
      (await request.post(`${PAIE}/paie/calculer`, { data: { employeeId: 1, mois: 1, annee: 2026 } })).status()
    ).toBe(200)
  })

  test('VULN-05 : la passerelle ne renvoie jamais 401 — elle n’authentifie rien', async ({ request }) => {
    // Sans jeton comme avec un jeton bidon, la réponse est identique : 404,
    // c'est-à-dire une erreur de ROUTAGE, jamais une erreur d'AUTHENTIFICATION.
    // Aucun contrôle d'accès n'est appliqué, il n'y a rien à contourner.
    const sansJeton = await request.get(`${GATEWAY}/api/conges/solde/1`)
    const avecJetonBidon = await request.get(`${GATEWAY}/api/conges/solde/1`, {
      headers: { Authorization: 'Bearer ceci-nest-pas-un-jeton' },
    })

    expect(sansJeton.status()).toBe(404)
    expect(avecJetonBidon.status()).toBe(404)
    expect(sansJeton.status()).not.toBe(401)
  })

  test('VULN-09 corrigée : le CORS refuse une origine non autorisée', async ({ request }) => {
    const reponse = await request.get(`${GATEWAY}/api/auth/login`, {
      headers: { Origin: 'https://site-malveillant.example' },
    })

    expect(reponse.headers()['access-control-allow-origin']).toBeUndefined()
    expect(reponse.headers()['access-control-allow-methods']).not.toBe('*')
  })
})
