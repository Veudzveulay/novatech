/** Parcours 1 — Connexion et contrôle d'accès. Auth (3001) → PostgreSQL. */
const { test, expect } = require('@playwright/test')
const { AUTH, CONGES, RECRUTEMENT } = require('./cibles')

test.describe('Parcours 1 — Connexion et accès refusé', () => {
  test('un DRH se connecte et reçoit un jeton exploitable', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })

    expect(reponse.status()).toBe(200)
    const corps = await reponse.json()
    expect(corps.user).toMatchObject({ email: 'rh@novatech.io', role: 'rh' })
    expect(corps.token).toBeTruthy()

    // Le jeton est vérifiable de bout en bout par le service auth.
    const verification = await request.post(`${AUTH}/auth/verify`, {
      data: { token: corps.token },
    })
    expect(verification.status()).toBe(200)
    expect((await verification.json()).valid).toBe(true)
  })

  test('un mot de passe erroné est refusé avec 401', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'MauvaisMotDePasse' },
    })

    expect(reponse.status()).toBe(401)
    expect(await reponse.json()).toEqual({ error: 'Invalid credentials' })
  })

  test('un compte inexistant est refusé avec le même message (pas d’énumération)', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'inexistant@novatech.io', password: 'peu importe' },
    })

    expect(reponse.status()).toBe(401)
    expect(await reponse.json()).toEqual({ error: 'Invalid credentials' })
  })

  test('VULN-01 corrigée : une injection SQL ne permet pas de s’authentifier', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/login`, {
      data: { email: "' OR '1'='1", password: 'Password123!' },
    })

    expect(reponse.status()).toBe(401)
    expect(await reponse.json()).toEqual({ error: 'Invalid credentials' })
  })

  test('VULN-05 : les routes métier restent publiques mais la route debug est supprimée', async ({ request }) => {
    // Aucun en-tête Authorization. Un contrôle d'accès digne de ce nom
    // renverrait 401 sur les trois appels.
    const conges = await request.get(`${CONGES}/conges/solde/1`)
    expect(conges.status()).toBe(200)

    const candidats = await request.get(`${RECRUTEMENT}/recrutement/candidats`)
    expect(candidats.status()).toBe(200)

    const debug = await request.get(`${CONGES}/conges/debug/all`)
    expect(debug.status()).toBe(404)
  })

  test('VULN-05 : un jeton manifestement invalide ne change rien', async ({ request }) => {
    const reponse = await request.get(`${CONGES}/conges/solde/1`, {
      headers: { Authorization: 'Bearer ceci-nest-pas-un-jeton' },
    })

    // Le jeton n'est même pas lu : les services n'ont aucun middleware d'auth.
    expect(reponse.status()).toBe(200)
  })
})
