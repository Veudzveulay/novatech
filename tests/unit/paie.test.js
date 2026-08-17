/**
 * Service Paie.
 *
 * axios est mocké : aucun appel ne doit sortir vers api.stripe.com, le code
 * retombant sur une clé `sk_live_` en dur si la variable est absente.
 */
const request = require('supertest')

jest.mock('axios')
jest.mock('../../services/paie/src/db', () => ({
  pool: { query: jest.fn() },
}))

const axios = require('axios')
const { pool } = require('../../services/paie/src/db')
const app = require('../../services/paie/src/app')

const EMPLOYE = { id: 1, nom: 'Durand', prenom: 'Alice', salaire_mensuel_brut: 3000 }

/** Prépare les deux appels de /paie/calculer : SELECT employé puis INSERT bulletin. */
function mockCalculer(employe = EMPLOYE) {
  pool.query
    .mockResolvedValueOnce({ rows: employe ? [employe] : [] }) // SELECT employees
    .mockResolvedValueOnce({ rows: [] })                        // INSERT bulletins_paie
}

beforeEach(() => {
  pool.query.mockReset()
  axios.post.mockReset()
  axios.post.mockResolvedValue({ data: { id: 'po_test' } })
})

describe('POST /paie/calculer — calcul du bulletin', () => {
  test('applique 22 % de cotisations salariales et 42 % de cotisations patronales', async () => {
    mockCalculer()

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(res.status).toBe(200)
    expect(res.body.brut).toBe(3000)
    expect(res.body.cotisationsSalariales).toBe(660)
    expect(res.body.cotisationsPatronales).toBe(1260)
  })

  test('le net est le brut moins les seules cotisations salariales', async () => {
    mockCalculer()

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(res.body.net).toBe(2340)
    // Les cotisations patronales sont calculées mais ne doivent pas amputer le net.
    expect(res.body.net).not.toBe(3000 - 660 - 1260)
  })

  test('reporte le mois, l’année et l’identifiant employé dans le bulletin', async () => {
    mockCalculer()

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(res.body).toMatchObject({ employeeId: 1, mois: 7, annee: 2026 })
    expect(new Date(res.body.generatedAt).toString()).not.toBe('Invalid Date')
  })

  test('persiste le bulletin en base avec une requête paramétrée', async () => {
    mockCalculer()

    await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

    const [sql, params] = pool.query.mock.calls[1]
    expect(sql).toContain('INSERT INTO bulletins_paie')
    expect(params[0]).toBe(1)
    expect(params[1]).toBe(7)
    expect(params[2]).toBe(2026)
    expect(JSON.parse(params[3])).toMatchObject({ brut: 3000, net: 2340 })
  })

  test('retourne 404 pour un employé inexistant, sans rien insérer ni payer', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 9999, mois: 7, annee: 2026 })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Employee not found' })
    expect(pool.query).toHaveBeenCalledTimes(1)
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('un salaire à zéro produit un bulletin à zéro sans erreur', async () => {
    mockCalculer({ ...EMPLOYE, id: 2, salaire_mensuel_brut: 0 })

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 2, mois: 7, annee: 2026 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ brut: 0, cotisationsSalariales: 0, net: 0 })
  })
})

describe('POST /paie/calculer — versement Stripe', () => {
  test('déclenche un payout du net converti en centimes, en euros', async () => {
    mockCalculer()

    await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(axios.post).toHaveBeenCalledTimes(1)
    const [url, corps] = axios.post.mock.calls[0]
    expect(url).toBe('https://api.stripe.com/v1/payouts')
    expect(corps).toEqual({ amount: 234000, currency: 'eur' })
  })

  test('BUG-02 : un échec du versement Stripe est avalé, l’API répond quand même 200', async () => {
    mockCalculer()
    axios.post.mockRejectedValue(new Error('card_declined'))

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    // Le bulletin est enregistré et renvoyé comme si tout s'était bien passé.
    // Côté métier : le salarié a un bulletin, mais pas son argent, et rien
    // dans la réponse ne permet de le savoir.
    expect(res.status).toBe(200)
    expect(res.body.net).toBe(2340)
    expect(console.error).toHaveBeenCalledWith('[PAIE] Stripe error (ignored):', 'card_declined')
  })

  test('VULN-03 : sans STRIPE_SECRET_KEY, la clé live du dépôt est utilisée', async () => {
    const cleOriginale = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    mockCalculer()

    try {
      await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

      const [, , options] = axios.post.mock.calls[0]
      expect(options.headers.Authorization).toBe(
        'Bearer sk_live_51NovaTech2021xxxxxxxxxxxxxxxxxxxxxxxxxxx'
      )
    } finally {
      process.env.STRIPE_SECRET_KEY = cleOriginale
    }
  })
})

describe('POST /paie/calculer — défauts de robustesse connus', () => {
  test('BUG-04 : les montants ne sont pas arrondis au centime', async () => {
    mockCalculer({ ...EMPLOYE, salaire_mensuel_brut: 2333.33 })

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    // Calcul en virgule flottante sur des euros : le bulletin porte des
    // montants à 4 décimales et des artefacts binaires.
    expect(res.body.cotisationsSalariales).toBe(513.3326)
    expect(res.body.cotisationsPatronales).toBe(979.9985999999999)
    expect(res.body.net).toBe(1819.9974)
  })

  test('BUG-05 : aucun contrôle sur le mois et l’année, un bulletin aberrant est accepté', async () => {
    mockCalculer()

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 99, annee: -1 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ mois: 99, annee: -1 })
  })

  test('BUG-05 : rien n’empêche de générer deux fois le bulletin du même mois', async () => {
    mockCalculer()
    const premier = await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

    mockCalculer()
    const second = await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(premier.status).toBe(200)
    expect(second.status).toBe(200)
    expect(axios.post).toHaveBeenCalledTimes(2)
  })
})

describe('POST /paie/heures-sup — régression d’avril 2024', () => {
  test('majore les heures supplémentaires de 25 % sur la base de 151,67 h', async () => {
    pool.query.mockResolvedValue({ rows: [{ salaire_mensuel_brut: 3000 }] })

    const res = await request(app)
      .post('/paie/heures-sup')
      .send({ employeeId: 1, heures: 10 })

    expect(res.status).toBe(200)
    expect(res.body.tauxHoraire).toBeCloseTo(19.7798, 3)
    expect(res.body.majorationHeuresSup).toBeCloseTo(247.2473, 3)
    expect(res.body.total).toBe(res.body.majorationHeuresSup)
  })

  test('zéro heure supplémentaire donne une majoration nulle', async () => {
    pool.query.mockResolvedValue({ rows: [{ salaire_mensuel_brut: 3000 }] })

    const res = await request(app).post('/paie/heures-sup').send({ employeeId: 1, heures: 0 })

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
  })

  test('BUG-01 : un employé inexistant fait planter le handler, aucune réponse n’est émise', async () => {
    // C'est la régression d'avril 2024 : `emp.rows[0]` n'est jamais vérifié.
    // Le handler est appelé directement — via HTTP la requête resterait
    // pendante indéfiniment, ce qui bloquerait Jest.
    pool.query.mockResolvedValue({ rows: [] })

    const couche = app._router.stack.find((l) => l.route && l.route.path === '/paie/heures-sup')
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()

    await expect(
      handler({ body: { employeeId: 9999, heures: 10 } }, res, next)
    ).rejects.toThrow(TypeError)

    expect(res.json).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  test('BUG-01 : un nombre d’heures négatif produit une majoration négative', async () => {
    pool.query.mockResolvedValue({ rows: [{ salaire_mensuel_brut: 3000 }] })

    const res = await request(app).post('/paie/heures-sup').send({ employeeId: 1, heures: -10 })

    expect(res.status).toBe(200)
    expect(res.body.total).toBeLessThan(0)
  })
})

describe('POST /paie/migrate', () => {
  test('exécute la migration et retourne un succès', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    const res = await request(app).post('/paie/migrate').send({})

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })

  test('VULN-04 : la route de migration est ouverte, sans authentification', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    const res = await request(app).post('/paie/migrate').send({}) // aucun en-tête Authorization

    expect(res.status).toBe(200)
    const sql = pool.query.mock.calls[0][0]
    expect(sql).toContain('ALTER TABLE employees')
    expect(sql).toContain('UPDATE employees SET updated_at = NOW()')
  })

  test('remonte un 500 avec le message d’erreur brut si la migration échoue', async () => {
    pool.query.mockRejectedValue(new Error('permission denied for table employees'))

    const res = await request(app).post('/paie/migrate').send({})

    expect(res.status).toBe(500)
    // Le message PostgreSQL est renvoyé tel quel au client (fuite d'information).
    expect(res.body.error).toBe('permission denied for table employees')
  })
})
