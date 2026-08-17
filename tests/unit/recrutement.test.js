/** Service Recrutement. */
const path = require('path')
const request = require('supertest')

jest.mock('../../services/recrutement/src/db', () => ({
  pool: { query: jest.fn() },
}))

const { pool } = require('../../services/recrutement/src/db')
const app = require('../../services/recrutement/src/app')

// Volontairement inerte : un vrai webshell serait mis en quarantaine par
// l'antivirus. Ce sont l'extension et le nom qui sont testés, pas le contenu.
const CONTENU_EXECUTABLE_FACTICE = Buffer.from(
  'contenu factice representant un script executable (VULN-07)'
)

const CANDIDAT = {
  id: 1,
  nom: 'Nguyen',
  prenom: 'David',
  email: 'david.nguyen@example.test',
  poste: 'Développeur backend',
  cv_path: '/tmp/uploads/cv.pdf',
  statut: 'nouveau',
}

beforeEach(() => {
  pool.query.mockReset()
})

describe('POST /recrutement/candidat', () => {
  test('enregistre une candidature avec un CV et retourne la ligne créée', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT] })

    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Nguyen')
      .field('prenom', 'David')
      .field('email', 'david.nguyen@example.test')
      .field('poste', 'Développeur backend')
      .attach('cv', Buffer.from('%PDF-1.4 contenu de test'), 'cv-david.pdf')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, nom: 'Nguyen' })

    const [sql, params] = pool.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO candidats')
    expect(params.slice(0, 4)).toEqual([
      'Nguyen',
      'David',
      'david.nguyen@example.test',
      'Développeur backend',
    ])
    expect(params[4]).toContain('cv-david.pdf')
  })

  test('accepte une candidature sans CV, avec un chemin de fichier indéfini', async () => {
    pool.query.mockResolvedValue({ rows: [{ ...CANDIDAT, cv_path: null }] })

    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Lopez')
      .field('prenom', 'Emma')

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][4]).toBeUndefined()
  })

  test('VULN-07 : aucun filtrage du type de fichier, un script exécutable est accepté', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT] })

    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Attaquant')
      .attach('cv', CONTENU_EXECUTABLE_FACTICE, 'shell.php')

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][4]).toContain('shell.php')
  })

  test('VULN-07 : le nom de fichier fourni par le client est conservé tel quel', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT] })

    await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Attaquant')
      .attach('cv', Buffer.from('x'), 'cv-normal.pdf')

    // multer est configuré avec `filename: (req, file, cb) => cb(null, file.originalname)` :
    // deux candidats qui envoient « cv.pdf » écrasent mutuellement leur fichier,
    // et rien ne neutralise les caractères de chemin.
    const cheminEnregistre = pool.query.mock.calls[0][1][4]
    expect(path.basename(cheminEnregistre)).toBe('cv-normal.pdf')
    expect(cheminEnregistre.startsWith(process.env.UPLOAD_DIR)).toBe(true)
  })

  test('VULN-07 : aucune limite de taille n’est configurée', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT] })

    // 5 Mo passent sans être refusés ; multer est instancié sans option `limits`.
    const gros = Buffer.alloc(5 * 1024 * 1024, 'a')
    const res = await request(app)
      .post('/recrutement/candidat')
      .field('nom', 'Volumineux')
      .attach('cv', gros, 'gros.pdf')

    expect(res.status).toBe(200)
  })

  test('VULN-08 : aucune validation des champs, une candidature entièrement vide est enregistrée', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 2 }] })

    const res = await request(app).post('/recrutement/candidat').field('nom', '')

    expect(res.status).toBe(200)
    // email et poste absents : la ligne part en base sans le moindre contrôle.
    expect(pool.query.mock.calls[0][1][2]).toBeUndefined()
  })
})

describe('GET /recrutement/candidats', () => {
  test('liste les candidatures les plus récentes en premier', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT, { ...CANDIDAT, id: 2 }] })

    const res = await request(app).get('/recrutement/candidats')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(pool.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC')
  })

  test('retourne un tableau vide quand il n’y a aucun candidat', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    const res = await request(app).get('/recrutement/candidats')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('VULN-08 : la liste complète des candidats est accessible sans authentification', async () => {
    pool.query.mockResolvedValue({ rows: [CANDIDAT] })

    const res = await request(app).get('/recrutement/candidats') // aucun jeton

    expect(res.status).toBe(200)
    expect(res.body[0].email).toBe('david.nguyen@example.test')
    // Ni LIMIT ni filtre : toute la base de candidats sort en une requête.
    expect(pool.query.mock.calls[0][0]).not.toContain('LIMIT')
  })
})

describe('PATCH /recrutement/candidat/:id/statut', () => {
  test('met à jour le statut du candidat visé', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] })

    const res = await request(app)
      .patch('/recrutement/candidat/1/statut')
      .send({ statut: 'entretien' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(pool.query.mock.calls[0][1]).toEqual(['entretien', '1'])
  })

  test('BUG-09 : répond success même quand aucune ligne n’a été modifiée', async () => {
    pool.query.mockResolvedValue({ rowCount: 0, rows: [] })

    const res = await request(app)
      .patch('/recrutement/candidat/999999/statut')
      .send({ statut: 'entretien' })

    // `rowCount` n'est jamais consulté : l'appelant ne peut pas distinguer une
    // mise à jour réussie d'un identifiant inexistant.
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })

  test('BUG-09 : accepte n’importe quelle valeur de statut', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] })

    const res = await request(app)
      .patch('/recrutement/candidat/1/statut')
      .send({ statut: 'valeur_totalement_arbitraire' })

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][0]).toBe('valeur_totalement_arbitraire')
  })

  test('BUG-09 : accepte un statut absent et écrit une valeur nulle', async () => {
    pool.query.mockResolvedValue({ rowCount: 1, rows: [] })

    const res = await request(app).patch('/recrutement/candidat/1/statut').send({})

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][0]).toBeUndefined()
  })
})
