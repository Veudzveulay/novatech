/**
 * Parcours 4 — Candidature. Recrutement (3004) → PostgreSQL + disque.
 *
 * Écart avec le scénario « offre + candidature » du plan : l'application ne
 * comporte aucune notion d'offre d'emploi. Le parcours couvre ce qui existe —
 * dépôt, consultation, suivi.
 */
const { test, expect } = require('@playwright/test')
const { RECRUTEMENT } = require('./cibles')

// Volontairement inerte : un vrai webshell serait mis en quarantaine par
// l'antivirus. Ce sont l'extension et le type MIME qui sont testés.
const CONTENU_EXECUTABLE_FACTICE = Buffer.from(
  'contenu factice representant un script executable (VULN-07)'
)

test.describe('Parcours 4 — Candidature', () => {
  test('un candidat dépose sa candidature avec un CV', async ({ request }) => {
    const reponse = await request.post(`${RECRUTEMENT}/recrutement/candidat`, {
      multipart: {
        nom: 'Moreau',
        prenom: 'Gabriel',
        email: 'gabriel.moreau@example.test',
        poste: 'Ingénieur DevOps',
        cv: {
          name: 'cv-gabriel.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 CV de Gabriel Moreau'),
        },
      },
    })

    expect(reponse.status()).toBe(200)
    const candidat = await reponse.json()
    expect(candidat).toMatchObject({
      nom: 'Moreau',
      email: 'gabriel.moreau@example.test',
      statut: 'nouveau',
    })
    expect(candidat.cv_path).toContain('cv-gabriel.pdf')
  })

  test('la candidature apparaît en tête de la liste consultée par le RH', async ({ request }) => {
    const reponse = await request.get(`${RECRUTEMENT}/recrutement/candidats`)

    expect(reponse.status()).toBe(200)
    const candidats = await reponse.json()
    expect(candidats.length).toBeGreaterThanOrEqual(3)
    expect(candidats[0].email).toBe('gabriel.moreau@example.test')
  })

  test('le RH fait passer le candidat au statut entretien', async ({ request }) => {
    const liste = await (await request.get(`${RECRUTEMENT}/recrutement/candidats`)).json()
    const gabriel = liste.find((c) => c.email === 'gabriel.moreau@example.test')

    const maj = await request.patch(`${RECRUTEMENT}/recrutement/candidat/${gabriel.id}/statut`, {
      data: { statut: 'entretien' },
    })

    expect(maj.status()).toBe(200)
    expect(await maj.json()).toEqual({ success: true })

    const apres = await (await request.get(`${RECRUTEMENT}/recrutement/candidats`)).json()
    expect(apres.find((c) => c.id === gabriel.id).statut).toBe('entretien')
  })

  test('VULN-07 : un fichier à extension exécutable est accepté comme CV', async ({ request }) => {
    const reponse = await request.post(`${RECRUTEMENT}/recrutement/candidat`, {
      multipart: {
        nom: 'Attaquant',
        email: 'attaquant.e2e@example.test',
        cv: {
          name: 'payload.php',
          mimeType: 'application/x-httpd-php',
          buffer: CONTENU_EXECUTABLE_FACTICE,
        },
      },
    })

    expect(reponse.status()).toBe(200)
    expect((await reponse.json()).cv_path).toContain('payload.php')
  })

  test('VULN-08 : la liste complète des candidats est lisible sans authentification', async ({ request }) => {
    const reponse = await request.get(`${RECRUTEMENT}/recrutement/candidats`)

    expect(reponse.status()).toBe(200)
    const candidats = await reponse.json()
    expect(candidats[0]).toHaveProperty('email')
    expect(candidats[0]).toHaveProperty('cv_path')
  })

  test('BUG-09 : mettre à jour un candidat inexistant répond success', async ({ request }) => {
    const reponse = await request.patch(`${RECRUTEMENT}/recrutement/candidat/999999/statut`, {
      data: { statut: 'embauche' },
    })

    expect(reponse.status()).toBe(200)
    expect(await reponse.json()).toEqual({ success: true })
  })
})
