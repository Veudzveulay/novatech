/**
 * Parcours 5 — Cycle RH complet : auth → congés → paie → recrutement.
 *
 * Remplace le parcours « entretien annuel » du plan initial : cette
 * fonctionnalité n'existe pas dans l'application livrée. C'est le scénario
 * retenu pour la démonstration en soutenance.
 *
 * Le jeton obtenu à l'étape 1 est transmis aux suivantes — aucune ne le
 * vérifie, ce qui est le constat de VULN-05.
 */
const { test, expect } = require('@playwright/test')
const { AUTH, PAIE, CONGES, RECRUTEMENT } = require('./cibles')

test.describe.configure({ mode: 'serial' })

test.describe('Parcours 5 — Cycle RH complet', () => {
  /** @type {string} */
  let jeton
  /** @type {number} */
  let idCandidature

  test('étape 1 — le DRH se connecte', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/login`, {
      data: { email: 'rh@novatech.io', password: 'Password123!' },
    })

    expect(reponse.status()).toBe(200)
    jeton = (await reponse.json()).token
    expect(jeton).toBeTruthy()
  })

  test('étape 2 — il consulte le solde de congés d’une salariée', async ({ request }) => {
    const reponse = await request.get(`${CONGES}/conges/solde/1`, {
      headers: { Authorization: `Bearer ${jeton}` },
    })

    expect(reponse.status()).toBe(200)
    const solde = await reponse.json()
    expect(solde.joursAcquis).toBe(25)
    expect(solde.solde).toBeLessThanOrEqual(25)
  })

  test('étape 3 — il enregistre une absence pour cette salariée', async ({ request }) => {
    const reponse = await request.post(`${CONGES}/conges/demande`, {
      headers: { Authorization: `Bearer ${jeton}` },
      data: {
        employeeId: 1,
        dateDebut: '2027-02-01',
        dateFin: '2027-02-06',
        motif: 'Parcours 5 — absence',
      },
    })

    expect(reponse.status()).toBe(200)
    expect((await reponse.json()).nombre_jours).toBe(5)
  })

  test('étape 4 — il génère le bulletin de paie du mois', async ({ request }) => {
    const reponse = await request.post(`${PAIE}/paie/calculer`, {
      headers: { Authorization: `Bearer ${jeton}` },
      data: { employeeId: 1, mois: 2, annee: 2027 },
    })

    expect(reponse.status()).toBe(200)
    const bulletin = await reponse.json()
    expect(bulletin.net).toBe(2340)

    // Constat métier majeur : les congés posés à l'étape 3 n'ont AUCUN effet
    // sur le bulletin. Les deux services ne communiquent pas — aucune retenue,
    // aucun report. C'est une limite fonctionnelle de l'application, pas un
    // défaut de ces tests.
    expect(bulletin).not.toHaveProperty('joursAbsence')
  })

  test('étape 5 — il ouvre le suivi des candidatures et dépose un dossier', async ({ request }) => {
    const reponse = await request.post(`${RECRUTEMENT}/recrutement/candidat`, {
      headers: { Authorization: `Bearer ${jeton}` },
      multipart: {
        nom: 'Rossi',
        prenom: 'Hélène',
        email: 'helene.rossi@example.test',
        poste: 'Chargée de recrutement',
        cv: {
          name: 'cv-helene.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 CV Hélène Rossi'),
        },
      },
    })

    expect(reponse.status()).toBe(200)
    idCandidature = (await reponse.json()).id
    expect(idCandidature).toBeTruthy()
  })

  test('étape 6 — il convoque la candidate en entretien', async ({ request }) => {
    const maj = await request.patch(`${RECRUTEMENT}/recrutement/candidat/${idCandidature}/statut`, {
      headers: { Authorization: `Bearer ${jeton}` },
      data: { statut: 'entretien' },
    })

    expect(maj.status()).toBe(200)

    const liste = await (await request.get(`${RECRUTEMENT}/recrutement/candidats`)).json()
    expect(liste.find((c) => c.id === idCandidature).statut).toBe('entretien')
  })

  test('étape 7 — le jeton du DRH est toujours valide en fin de parcours', async ({ request }) => {
    const reponse = await request.post(`${AUTH}/auth/verify`, { data: { token: jeton } })

    expect(reponse.status()).toBe(200)
    const resultat = await reponse.json()
    expect(resultat.valid).toBe(true)
    expect(resultat.user.role).toBe('rh')
  })
})
