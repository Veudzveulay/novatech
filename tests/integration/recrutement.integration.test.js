/**
 * Service Recrutement sur un vrai PostgreSQL — npm run db:test:up requis.
 *
 * Ces tests écrivent de vrais fichiers dans un répertoire temporaire isolé
 * (UPLOAD_DIR, cf. tests/setup/env.js) : c'est le seul moyen de démontrer
 * l'écrasement permis par la configuration de multer.
 */
const fs = require('fs')
const path = require('path')
const request = require('supertest')

const { resetDatabase, query, closePool } = require('../helpers/db')
const app = require('../../services/recrutement/src/app')
const { pool } = require('../../services/recrutement/src/db')

// Volontairement inerte : un vrai webshell serait mis en quarantaine par
// l'antivirus. C'est l'extension écrite sur le disque qui est testée.
const CONTENU_EXECUTABLE_FACTICE = Buffer.from(
  'contenu factice representant un script executable (VULN-07)'
)

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await closePool()
  await pool.end()
})

describe('POST /recrutement/candidat — persistance', () => {
  test('crée la candidature en base et stocke le CV sur disque', async () => {
    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Bernard')
      .field('prenom', 'Fatou')
      .field('email', 'fatou.bernard@example.test')
      .field('poste', 'SRE')
      .attach('cv', Buffer.from('%PDF-1.4 cv de test'), 'cv-fatou.pdf')

    expect(res.status).toBe(200)

    const enBase = await query('SELECT * FROM candidats WHERE email = $1', [
      'fatou.bernard@example.test',
    ])
    expect(enBase.rows).toHaveLength(1)
    expect(enBase.rows[0].poste).toBe('SRE')
    expect(fs.existsSync(enBase.rows[0].cv_path)).toBe(true)
  })

  test('le statut par défaut appliqué par la base est « nouveau »', async () => {
    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Sans')
      .field('prenom', 'Statut')
      .field('email', 'sans.statut@example.test')

    expect(res.body.statut).toBe('nouveau')
  })

  test('VULN-07 confirmée sur disque : deux candidats envoyant « cv.pdf » écrasent le même fichier', async () => {
    await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Premier')
      .field('email', 'premier@example.test')
      .attach('cv', Buffer.from('CV DU PREMIER CANDIDAT'), 'cv.pdf')

    await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Second')
      .field('email', 'second@example.test')
      .attach('cv', Buffer.from('CV DU SECOND CANDIDAT'), 'cv.pdf')

    // On ne regarde QUE les deux candidatures créées par ce test : le jeu de
    // données initial contient déjà deux candidats avec un cv_path renseigné.
    const lignes = await query(
      "SELECT nom, cv_path FROM candidats WHERE email IN ('premier@example.test', 'second@example.test') ORDER BY id"
    )
    expect(lignes.rows).toHaveLength(2)

    const cheminsDistincts = new Set(lignes.rows.map((l) => l.cv_path))

    // Les deux candidatures pointent vers le MÊME fichier...
    expect(cheminsDistincts.size).toBe(1)
    // ...dont le contenu est celui du dernier arrivé. Le CV du premier
    // candidat est définitivement perdu.
    const contenu = fs.readFileSync([...cheminsDistincts][0], 'utf8')
    expect(contenu).toBe('CV DU SECOND CANDIDAT')
  })

  test('VULN-07 confirmée sur disque : un fichier exécutable est écrit tel quel', async () => {
    await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Attaquant')
      .field('email', 'attaquant@example.test')
      .attach('cv', CONTENU_EXECUTABLE_FACTICE, 'shell.php')

    const ligne = await query('SELECT cv_path FROM candidats WHERE email = $1', [
      'attaquant@example.test',
    ])
    const chemin = ligne.rows[0].cv_path

    // Ni le type MIME ni l'extension ne sont contrôlés : le fichier est écrit
    // sur le disque du serveur avec l'extension choisie par l'appelant.
    expect(path.extname(chemin)).toBe('.php')
    expect(fs.existsSync(chemin)).toBe(true)
    expect(fs.readFileSync(chemin, 'utf8')).toBe(CONTENU_EXECUTABLE_FACTICE.toString())
  })
})

describe('GET /recrutement/candidats — sur données réelles', () => {
  test('retourne les candidats du jeu de données, du plus récent au plus ancien', async () => {
    const res = await request(app).get('/recrutement/candidats')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].prenom).toBe('Emma') // 15/07, plus récente que David (01/07)
    expect(res.body[1].prenom).toBe('David')
  })

  test('une candidature créée à l’instant apparaît en tête de liste', async () => {
    await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Tout')
      .field('prenom', 'Neuf')
      .field('email', 'tout.neuf@example.test')

    const res = await request(app).get('/recrutement/candidats')

    expect(res.body[0].prenom).toBe('Neuf')
    expect(res.body).toHaveLength(3)
  })
})

describe('PATCH /recrutement/candidat/:id/statut — sur données réelles', () => {
  test('modifie effectivement le statut en base', async () => {
    const res = await request(app)
      .patch('/recrutement/candidat/1/statut')
      .send({ statut: 'embauche' })

    expect(res.status).toBe(200)

    const enBase = await query('SELECT statut FROM candidats WHERE id = 1')
    expect(enBase.rows[0].statut).toBe('embauche')
  })

  test('BUG-09 confirmé en base : un identifiant inexistant répond success sans rien modifier', async () => {
    const res = await request(app)
      .patch('/recrutement/candidat/999999/statut')
      .send({ statut: 'embauche' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    const inchanges = await query("SELECT COUNT(*)::int AS n FROM candidats WHERE statut = 'embauche'")
    expect(inchanges.rows[0].n).toBe(0)
  })

  test('BUG-09 confirmé en base : un statut arbitraire est accepté par le schéma', async () => {
    await request(app).patch('/recrutement/candidat/1/statut').send({ statut: 'nimporte_quoi' })

    const enBase = await query('SELECT statut FROM candidats WHERE id = 1')
    // Aucune contrainte CHECK côté base, aucune validation côté code.
    expect(enBase.rows[0].statut).toBe('nimporte_quoi')
  })
})
