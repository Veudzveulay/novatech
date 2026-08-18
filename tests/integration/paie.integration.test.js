/**
 * Service Paie sur un vrai PostgreSQL — npm run db:test:up requis.
 *
 * axios reste mocké : un test d'intégration ne doit jamais déclencher de
 * virement. Ce qui est intégré ici, c'est la persistance du bulletin.
 */
const request = require('supertest')

jest.mock('axios')

const axios = require('axios')
const { resetDatabase, query, closePool } = require('../helpers/db')
const app = require('../../services/paie/src/app')
const { pool } = require('../../services/paie/src/db')

beforeEach(async () => {
  await resetDatabase()
  axios.post.mockReset()
  axios.post.mockResolvedValue({ data: { id: 'po_test' } })
})

afterAll(async () => {
  await closePool()
  await pool.end()
})

describe('POST /paie/calculer — persistance du bulletin', () => {
  test('enregistre le bulletin en base et le renvoie au client', async () => {
    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(res.status).toBe(200)

    const enBase = await query(
      'SELECT * FROM bulletins_paie WHERE employee_id = $1 AND mois = $2 AND annee = $3',
      [1, 7, 2026]
    )
    expect(enBase.rows).toHaveLength(1)
    // `brut` est une CHAÎNE et non un nombre : le pilote pg renvoie les colonnes
    // NUMERIC sous forme de texte, et le code le recopie tel quel dans le
    // bulletin. Voir le test suivant et BUG-04.
    expect(enBase.rows[0].data).toMatchObject({
      brut: '3000.00',
      net: 2340,
      cotisationsSalariales: 660,
    })
  })

  test('le salaire lu en base est bien un NUMERIC : PostgreSQL le renvoie en chaîne', async () => {
    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 8, annee: 2026 })

    // Défaut de typage réel, invisible en test unitaire : pg renvoie NUMERIC
    // sous forme de string. Le code applique alors `'3000.00' * 0.22`, qui
    // fonctionne par coercition, mais `salaireBase - cotisations` opère sur
    // une chaîne. Le brut sort donc en chaîne dans le bulletin.
    expect(typeof res.body.brut).toBe('string')
    expect(res.body.brut).toBe('3000.00')
    expect(res.body.cotisationsSalariales).toBe(660)
    expect(res.body.net).toBe(2340)
  })

  test('retourne 404 et n’insère rien pour un employé absent de la base', async () => {
    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 999999, mois: 7, annee: 2026 })

    expect(res.status).toBe(404)

    const total = await query('SELECT COUNT(*)::int AS n FROM bulletins_paie')
    expect(total.rows[0].n).toBe(0)
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('BUG-05 confirmé en base : deux bulletins identiques coexistent pour le même mois', async () => {
    await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })
    await request(app).post('/paie/calculer').send({ employeeId: 1, mois: 7, annee: 2026 })

    const doublons = await query(
      'SELECT COUNT(*)::int AS n FROM bulletins_paie WHERE employee_id = 1 AND mois = 7 AND annee = 2026'
    )
    // Aucune contrainte d'unicité (employee_id, mois, annee) : le salarié a
    // deux bulletins et deux versements Stripe pour le même mois.
    expect(doublons.rows[0].n).toBe(2)
    expect(axios.post).toHaveBeenCalledTimes(2)
  })

  test('BUG-02 confirmé en base : le bulletin est persisté même si le versement échoue', async () => {
    axios.post.mockRejectedValue(new Error('insufficient_funds'))

    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 1, mois: 7, annee: 2026 })

    expect(res.status).toBe(200)

    const enBase = await query('SELECT COUNT(*)::int AS n FROM bulletins_paie')
    // Bulletin émis, argent non versé, aucune trace de l'écart : c'est
    // exactement le scénario de réclamation paie.
    expect(enBase.rows[0].n).toBe(1)
  })

  test('un employé au salaire nul produit un bulletin à zéro persisté', async () => {
    const res = await request(app)
      .post('/paie/calculer')
      .send({ employeeId: 2, mois: 7, annee: 2026 })

    expect(res.status).toBe(200)

    const enBase = await query('SELECT data FROM bulletins_paie WHERE employee_id = 2')
    expect(enBase.rows[0].data.net).toBe(0)
  })
})

describe('POST /paie/heures-sup — sur données réelles', () => {
  test('calcule la majoration à partir du salaire réellement stocké', async () => {
    const res = await request(app).post('/paie/heures-sup').send({ employeeId: 1, heures: 10 })

    expect(res.status).toBe(200)
    expect(res.body.majorationHeuresSup).toBeCloseTo(247.2473, 3)
  })

  test('BUG-01 confirmé en base : un employé absent fait planter le handler', async () => {
    const couche = app._router.stack.find((l) => l.route && l.route.path === '/paie/heures-sup')
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }

    await expect(
      handler({ body: { employeeId: 999999, heures: 10 } }, res, jest.fn())
    ).rejects.toThrow(TypeError)

    expect(res.json).not.toHaveBeenCalled()
  })
})

describe('POST /paie/migrate — sur données réelles', () => {
  test('VULN-04 : la route non authentifiée modifie réellement le schéma', async () => {
    const res = await request(app).post('/paie/migrate').send({})

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    // La colonne a bien été ajoutée par un appel HTTP anonyme.
    const colonnes = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'salaire_variable'"
    )
    expect(colonnes.rows).toHaveLength(1)
  })

  test('VULN-04 : elle réécrit updated_at sur toute la table employees', async () => {
    const avant = await query('SELECT id, updated_at FROM employees ORDER BY id')

    await new Promise((r) => setTimeout(r, 50))
    await request(app).post('/paie/migrate').send({})

    const apres = await query('SELECT id, updated_at FROM employees ORDER BY id')
    for (let i = 0; i < avant.rows.length; i++) {
      expect(apres.rows[i].updated_at.getTime()).toBeGreaterThan(avant.rows[i].updated_at.getTime())
    }
  })
})
