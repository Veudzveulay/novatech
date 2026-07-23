/**
 * Parcours 3 — Cycle de paie. Paie (3002) → PostgreSQL.
 *
 * L'appel Stripe est neutralisé par un proxy mort (playwright.config.js) :
 * aucune requête ne peut sortir avec la clé `sk_live_` du dépôt.
 */
const { test, expect } = require('@playwright/test')
const { PAIE } = require('./cibles')

test.describe('Parcours 3 — Cycle de paie', () => {
  test('le gestionnaire de paie génère le bulletin du mois', async ({ request }) => {
    const reponse = await request.post(`${PAIE}/paie/calculer`, {
      data: { employeeId: 1, mois: 7, annee: 2026 },
    })

    expect(reponse.status()).toBe(200)
    const bulletin = await reponse.json()
    expect(bulletin).toMatchObject({ employeeId: 1, mois: 7, annee: 2026 })
    expect(bulletin.cotisationsSalariales).toBe(660)
    expect(bulletin.cotisationsPatronales).toBe(1260)
    expect(bulletin.net).toBe(2340)
  })

  test('BUG-02 en conditions réelles : le versement échoue et l’API répond quand même 200', async ({ request }) => {
    // L'appel sortant vers api.stripe.com est volontairement impossible dans
    // cet environnement (proxy mort). Le code intercepte l'erreur et poursuit.
    const reponse = await request.post(`${PAIE}/paie/calculer`, {
      data: { employeeId: 1, mois: 6, annee: 2026 },
    })

    expect(reponse.status()).toBe(200)
    const bulletin = await reponse.json()
    // Rien dans la réponse ne signale que le salarié n'a pas été payé.
    expect(bulletin.net).toBe(2340)
    expect(bulletin).not.toHaveProperty('paiement')
    expect(bulletin).not.toHaveProperty('statutVersement')
  })

  test('un employé inexistant est correctement rejeté en 404', async ({ request }) => {
    const reponse = await request.post(`${PAIE}/paie/calculer`, {
      data: { employeeId: 999999, mois: 7, annee: 2026 },
    })

    expect(reponse.status()).toBe(404)
    expect(await reponse.json()).toEqual({ error: 'Employee not found' })
  })

  test('le calcul des heures supplémentaires majore bien de 25 %', async ({ request }) => {
    const reponse = await request.post(`${PAIE}/paie/heures-sup`, {
      data: { employeeId: 1, heures: 8 },
    })

    expect(reponse.status()).toBe(200)
    const resultat = await reponse.json()
    expect(resultat.tauxHoraire).toBeCloseTo(19.78, 1)
    expect(resultat.total).toBeCloseTo(197.8, 1)
  })

  // BUG-01 (heures-sup sur un employé inexistant) n'est PAS testé ici : il ne
  // se contente pas de ne pas répondre, il TUE le processus du service — ce qui
  // ferait échouer tous les tests suivants. La démonstration est isolée dans
  // tests/e2e/06-deni-de-service.spec.js, sur une instance dédiée.

  test('BUG-05 : le même bulletin peut être généré deux fois', async ({ request }) => {
    await request.post(`${PAIE}/paie/calculer`, { data: { employeeId: 3, mois: 5, annee: 2026 } })
    const second = await request.post(`${PAIE}/paie/calculer`, {
      data: { employeeId: 3, mois: 5, annee: 2026 },
    })

    expect(second.status()).toBe(200)
  })

  test('VULN-04 : la route de migration reste accessible sans authentification', async ({ request }) => {
    const reponse = await request.post(`${PAIE}/paie/migrate`, { data: {} })

    expect(reponse.status()).toBe(200)
    expect(await reponse.json()).toEqual({ success: true })
  })
})
