/** Parcours 0 — Routage de l'API Gateway après correction de BUG-12. */
const { test, expect } = require('@playwright/test')
const { GATEWAY, AUTH, PAIE, CONGES, RECRUTEMENT } = require('./cibles')

test.describe('Parcours 0 — Routage de la passerelle', () => {
  test('la passerelle est bien démarrée et répond sur /health', async ({ request }) => {
    const reponse = await request.get(`${GATEWAY}/health`)

    expect(reponse.status()).toBe(200)
    expect(await reponse.json()).toEqual({ status: 'ok' })
  })

  test('BUG-12 corrigé : une connexion valide traverse la passerelle', async ({ request }) => {
    const parLaPasserelle = await request.post(`${GATEWAY}/api/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })
    expect(parLaPasserelle.status()).toBe(200)
    expect((await parLaPasserelle.json()).token).toBeTruthy()

    // Exactement la même requête, adressée directement au service : 200.
    const enDirect = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })
    expect(enDirect.status()).toBe(200)
    expect((await enDirect.json()).token).toBeTruthy()
  })

  test('BUG-12 corrigé : les 4 services sont routés par la passerelle', async ({ request }) => {
    const appels = [
      ['/api/auth/verify', 'POST', 401],
      ['/api/paie/calculer', 'POST', 404],
      ['/api/conges/solde/1', 'GET', 200],
      ['/api/recrutement/candidats', 'GET', 200],
    ]

    for (const [chemin, methode, statutAttendu] of appels) {
      const reponse =
        methode === 'GET'
          ? await request.get(`${GATEWAY}${chemin}`)
          : await request.post(`${GATEWAY}${chemin}`, { data: {} })

      expect(reponse.status(), `${methode} ${chemin}`).toBe(statutAttendu)
    }
  })

  test('BUG-12 : les mêmes routes répondent quand on s’adresse au service', async ({ request }) => {
    expect((await request.get(`${CONGES}/conges/solde/1`)).status()).toBe(200)
    expect((await request.get(`${RECRUTEMENT}/recrutement/candidats`)).status()).toBe(200)
    expect(
      (await request.post(`${PAIE}/paie/calculer`, { data: { employeeId: 1, mois: 1, annee: 2026 } })).status()
    ).toBe(200)
  })

  test('VULN-05 : le routage corrigé ne fournit toujours pas de contrôle d’accès', async ({ request }) => {
    // Le correctif de routage ne constitue pas un contrôle d'accès : sans
    // jeton comme avec un jeton bidon, la route métier reste accessible.
    const sansJeton = await request.get(`${GATEWAY}/api/conges/solde/1`)
    const avecJetonBidon = await request.get(`${GATEWAY}/api/conges/solde/1`, {
      headers: { Authorization: 'Bearer ceci-nest-pas-un-jeton' },
    })

    expect(sansJeton.status()).toBe(200)
    expect(avecJetonBidon.status()).toBe(200)
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
