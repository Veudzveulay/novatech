/** Service Congés sur un vrai PostgreSQL — npm run db:test:up requis. */
const request = require('supertest')

const { resetDatabase, query, closePool } = require('../helpers/db')
const app = require('../../services/conges/src/app')
const { pool } = require('../../services/conges/src/db')

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await closePool()
  await pool.end()
})

describe('GET /conges/solde/:employeeId — sur données réelles', () => {
  test('Alice a 5 jours approuvés et 3 en attente sur 25 acquis', async () => {
    const res = await request(app).get('/conges/solde/1')

    expect(res.status).toBe(200)
    expect(res.body.joursAcquis).toBe(25)
    expect(res.body.joursPris).toBe(5)
    expect(res.body.joursEnAttente).toBe(3)
  })

  test('BUG-03 confirmé en base : le solde affiché ignore les 3 jours en attente', async () => {
    const res = await request(app).get('/conges/solde/1')

    expect(res.body.solde).toBe(20)
    expect(res.body.solde).not.toBe(res.body.joursAcquis - res.body.joursPris - res.body.joursEnAttente)
  })

  test('Chloé a épuisé ses 5 jours : solde à zéro', async () => {
    const res = await request(app).get('/conges/solde/3')

    expect(res.body).toMatchObject({ joursAcquis: 5, joursPris: 5, solde: 0 })
  })

  test('seuls les congés au statut « approuve » sont décomptés', async () => {
    await query(
      "INSERT INTO conges (employee_id, date_debut, date_fin, nombre_jours, motif, statut) VALUES (1, '2026-09-01', '2026-09-11', 10, 'Refusé', 'refuse')"
    )

    const res = await request(app).get('/conges/solde/1')

    expect(res.body.joursPris).toBe(5)
    expect(res.body.solde).toBe(20)
  })

  test('BUG-07 confirmé en base : un identifiant inexistant renvoie 25 jours au lieu d’un 404', async () => {
    const res = await request(app).get('/conges/solde/999999')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ joursAcquis: 25, joursPris: 0, solde: 25 })
  })

  test('un identifiant non numérique provoque une erreur PostgreSQL non gérée', async () => {
    // La valeur d'URL est passée telle quelle à une colonne INTEGER.
    // On appelle le handler directement : via HTTP la requête resterait pendante.
    const couche = app._router.stack.find((l) => l.route && l.route.path === '/conges/solde/:employeeId')
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }

    await expect(handler({ params: { employeeId: 'abc' } }, res, jest.fn())).rejects.toThrow(
      /invalid input syntax for type integer/
    )
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('POST /conges/demande — sur données réelles', () => {
  test('insère réellement la demande et la rend visible dans le solde en attente', async () => {
    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-10-05', dateFin: '2026-10-09', motif: 'Congé automne' })

    expect(res.status).toBe(200)
    expect(res.body.id).toBeDefined()
    expect(res.body.statut).toBe('en_attente')
    expect(res.body.nombre_jours).toBe(4)

    const enBase = await query('SELECT * FROM conges WHERE id = $1', [res.body.id])
    expect(enBase.rows).toHaveLength(1)
    expect(enBase.rows[0].motif).toBe('Congé automne')

    const solde = await request(app).get('/conges/solde/1')
    expect(solde.body.joursEnAttente).toBe(3 + 4)
  })

  test('la demande créée porte bien un created_at renseigné par la base', async () => {
    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-11-02', dateFin: '2026-11-06' })

    expect(res.body.created_at).toBeDefined()
    expect(new Date(res.body.created_at).toString()).not.toBe('Invalid Date')
  })

  test('BUG-08 confirmé en base : une demande de -10 jours est acceptée et stockée', async () => {
    const res = await request(app)
      .post('/conges/demande')
      .send({ employeeId: 1, dateDebut: '2026-08-20', dateFin: '2026-08-10' })

    expect(res.status).toBe(200)

    const enBase = await query('SELECT nombre_jours FROM conges WHERE id = $1', [res.body.id])
    expect(enBase.rows[0].nombre_jours).toBe(-10)
  })

  test('une demande pour un employé inexistant est rejetée par la contrainte de clé étrangère, sans réponse HTTP', async () => {
    const couche = app._router.stack.find((l) => l.route && l.route.path === '/conges/demande')
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }

    await expect(
      handler(
        { body: { employeeId: 999999, dateDebut: '2026-08-01', dateFin: '2026-08-05', motif: 'x' } },
        res,
        jest.fn()
      )
    ).rejects.toThrow(/violates foreign key constraint/)

    // La base protège l'intégrité ; l'application, elle, ne traduit pas
    // l'erreur en réponse exploitable par le client.
    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('GET /conges/debug/all — sur données réelles', () => {
  test('la route de debug n’est plus exposée', async () => {
    const res = await request(app).get('/conges/debug/all')

    expect(res.status).toBe(404)
  })
})
