/** Service Congés. */
const request = require('supertest')

jest.mock('../../services/conges/src/db', () => ({
  pool: { query: jest.fn() },
}))

const { pool } = require('../../services/conges/src/db')
const app = require('../../services/conges/src/app')

/**
 * /conges/solde enchaîne 3 requêtes : employé, congés approuvés, congés en attente.
 */
function mockSolde({ employe = { jours_conges_acquis: 25 }, approuves = [], enAttente = [] } = {}) {
  pool.query
    .mockResolvedValueOnce({ rows: employe ? [employe] : [] })
    .mockResolvedValueOnce({ rows: approuves })
    .mockResolvedValueOnce({ rows: enAttente })
}

beforeEach(() => {
  pool.query.mockReset()
})

describe('GET /conges/solde/:employeeId', () => {
  test('calcule le solde à partir des jours acquis et des congés approuvés', async () => {
    mockSolde({
      employe: { jours_conges_acquis: 25 },
      approuves: [{ nombre_jours: 5 }],
      enAttente: [],
    })

    const res = await request(app).get('/conges/solde/1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ solde: 20, joursAcquis: 25, joursPris: 5, joursEnAttente: 0 })
  })

  test('agrège plusieurs demandes approuvées', async () => {
    mockSolde({
      approuves: [{ nombre_jours: 5 }, { nombre_jours: 3 }, { nombre_jours: 2 }],
    })

    const res = await request(app).get('/conges/solde/1')

    expect(res.body.joursPris).toBe(10)
    expect(res.body.solde).toBe(15)
  })

  test('interroge la base avec des requêtes paramétrées', async () => {
    mockSolde()

    await request(app).get('/conges/solde/42')

    // Contrairement au service auth, ce service paramètre correctement ses
    // requêtes : aucune injection possible ici.
    expect(pool.query.mock.calls[0][1]).toEqual(['42'])
    expect(pool.query.mock.calls[1][1]).toEqual(['42', 'approuve'])
    expect(pool.query.mock.calls[2][1]).toEqual(['42', 'en_attente'])
  })

  test('un solde entièrement consommé vaut zéro', async () => {
    mockSolde({
      employe: { jours_conges_acquis: 5 },
      approuves: [{ nombre_jours: 5 }],
    })

    const res = await request(app).get('/conges/solde/3')

    expect(res.body.solde).toBe(0)
  })

  test('BUG-03 : les congés en attente sont comptés mais jamais déduits du solde', async () => {
    mockSolde({
      employe: { jours_conges_acquis: 25 },
      approuves: [{ nombre_jours: 5 }],
      enAttente: [{ nombre_jours: 3 }],
    })

    const res = await request(app).get('/conges/solde/1')

    // Le salarié voit 20 jours disponibles alors qu'il ne lui en reste 17 :
    // rien ne l'empêche de reposer les mêmes jours.
    expect(res.body.joursEnAttente).toBe(3)
    expect(res.body.solde).toBe(20)
    expect(res.body.solde).not.toBe(17)
  })

  test('BUG-07 : un employé inexistant reçoit un solde par défaut de 25 jours au lieu d’un 404', async () => {
    mockSolde({ employe: null })

    const res = await request(app).get('/conges/solde/999999')

    expect(res.status).toBe(200)
    expect(res.body.joursAcquis).toBe(25)
    expect(res.body.solde).toBe(25)
  })

  test('BUG-07 : un employé avec 0 jour acquis se voit attribuer 25 jours (test de vérité au lieu de nullité)', async () => {
    mockSolde({ employe: { jours_conges_acquis: 0 } })

    const res = await request(app).get('/conges/solde/2')

    // `employee.rows[0]?.jours_conges_acquis || 25` : 0 est falsy, donc écrasé.
    expect(res.body.joursAcquis).toBe(25)
    expect(res.body.solde).toBe(25)
  })
})

describe('POST /conges/demande', () => {
  test('crée une demande en attente et calcule le nombre de jours', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 10, employee_id: 1, nombre_jours: 4, statut: 'en_attente' }],
    })

    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-08-03', dateFin: '2026-08-07', motif: 'Vacances' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 10, statut: 'en_attente' })

    const [, params] = pool.query.mock.calls[0]
    expect(params[3]).toBe(4) // 3 → 7 août = 4 jours au sens du code
    expect(params[5]).toBe('en_attente')
  })

  test('une demande sur une seule journée compte zéro jour', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 11 }] })

    await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-08-03', dateFin: '2026-08-03' })

    // Défaut fonctionnel : le code fait une simple différence de dates, sans
    // borne incluse. Poser une journée enregistre 0 jour décompté.
    expect(pool.query.mock.calls[0][1][3]).toBe(0)
  })

  test('BUG-08 : une date de fin antérieure à la date de début est acceptée avec un nombre de jours négatif', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 12 }] })

    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-08-20', dateFin: '2026-08-10' })

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][3]).toBe(-10)
  })

  test('BUG-08 : une date invalide est enregistrée avec un nombre de jours NaN', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 13 }] })

    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: 'pas-une-date', dateFin: '2026-08-10' })

    expect(res.status).toBe(200)
    expect(pool.query.mock.calls[0][1][3]).toBeNaN()
  })

  test('BUG-08 : aucun contrôle de solde, une demande de 300 jours passe', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 14 }] })

    await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-01-01', dateFin: '2026-12-31' })

    expect(pool.query.mock.calls[0][1][3]).toBe(364)
  })
})

describe('GET /conges/debug/all', () => {
  test('n’est plus exposé par le service', async () => {
    const res = await request(app).get('/conges/debug/all')

    expect(res.status).toBe(404)
    expect(pool.query).not.toHaveBeenCalled()
  })
})
