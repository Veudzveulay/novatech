/** Parcours 2 — Demande de congé et suivi du solde. Congés (3003) → PostgreSQL. */
const { test, expect } = require('@playwright/test')
const { CONGES } = require('./cibles')

test.describe('Parcours 2 — Demande de congé', () => {
  test('un salarié consulte son solde initial', async ({ request }) => {
    const reponse = await request.get(`${CONGES}/conges/solde/1`)

    expect(reponse.status()).toBe(200)
    const solde = await reponse.json()
    expect(solde.joursAcquis).toBe(25)
    expect(solde.joursPris).toBe(5)
  })

  test('il dépose une demande, qui est créée en attente', async ({ request }) => {
    const reponse = await request.post(`${CONGES}/conges/demande`, {
      data: {
        employeeId: 1,
        dateDebut: '2026-09-07',
        dateFin: '2026-09-11',
        motif: 'Congé E2E parcours 2',
      },
    })

    expect(reponse.status()).toBe(200)
    const demande = await reponse.json()
    expect(demande.id).toBeTruthy()
    expect(demande.statut).toBe('en_attente')
    expect(demande.nombre_jours).toBe(4)
  })

  test('la demande apparaît dans les jours en attente du solde', async ({ request }) => {
    const avant = await (await request.get(`${CONGES}/conges/solde/1`)).json()

    await request.post(`${CONGES}/conges/demande`, {
      data: { employeeId: 1, dateDebut: '2026-10-05', dateFin: '2026-10-07', motif: 'Suivi solde' },
    })

    const apres = await (await request.get(`${CONGES}/conges/solde/1`)).json()
    expect(apres.joursEnAttente).toBe(avant.joursEnAttente + 2)
  })

  test('BUG-03 en conditions réelles : le solde affiché ne bouge pas malgré les demandes en attente', async ({ request }) => {
    const avant = await (await request.get(`${CONGES}/conges/solde/1`)).json()

    await request.post(`${CONGES}/conges/demande`, {
      data: { employeeId: 1, dateDebut: '2026-11-02', dateFin: '2026-11-12', motif: '10 jours' },
    })

    const apres = await (await request.get(`${CONGES}/conges/solde/1`)).json()

    // 10 jours ont été demandés, le solde annoncé au salarié est inchangé.
    expect(apres.joursEnAttente).toBe(avant.joursEnAttente + 10)
    expect(apres.solde).toBe(avant.solde)
  })

  test('BUG-03 : rien n’empêche de poser deux fois la même période', async ({ request }) => {
    const donnees = {
      employeeId: 1,
      dateDebut: '2026-12-14',
      dateFin: '2026-12-18',
      motif: 'Doublon volontaire',
    }

    const premiere = await request.post(`${CONGES}/conges/demande`, { data: donnees })
    const seconde = await request.post(`${CONGES}/conges/demande`, { data: donnees })

    expect(premiere.status()).toBe(200)
    expect(seconde.status()).toBe(200)
    expect((await premiere.json()).id).not.toBe((await seconde.json()).id)
  })

  test('BUG-08 : une période inversée est acceptée de bout en bout', async ({ request }) => {
    const reponse = await request.post(`${CONGES}/conges/demande`, {
      data: { employeeId: 1, dateDebut: '2026-08-20', dateFin: '2026-08-10', motif: 'Période inversée' },
    })

    expect(reponse.status()).toBe(200)
    expect((await reponse.json()).nombre_jours).toBe(-10)
  })
})
