/**
 * Service Auth sur un vrai PostgreSQL — npm run db:test:up requis.
 *
 * Le test unitaire prouve que la chaîne est concaténée ; celui-ci prouve que
 * le moteur exécute la charge utile (VULN-01).
 */
const request = require('supertest')

const { resetDatabase, query, closePool } = require('../helpers/db')
const app = require('../../services/auth/src/app')
const { pool } = require('../../services/auth/src/db')

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await closePool()
  await pool.end()
})

describe('POST /auth/login — sur données réelles', () => {
  test('authentifie un utilisateur réellement présent en base', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'rh@novatech.io', password: 'Password123!' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: 'rh@novatech.io', role: 'rh' })
    expect(res.body.token).toEqual(expect.any(String))
  })

  test('refuse un mot de passe erroné pour un compte existant', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'employe@novatech.io', password: 'MauvaisMotDePasse' })

    expect(res.status).toBe(401)
  })

  test('refuse un compte absent de la base', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'personne@novatech.io', password: 'Password123!' })

    expect(res.status).toBe(401)
  })
})

describe('VULN-01 — injection SQL exploitable contre PostgreSQL', () => {
  test('la charge `\' OR \'1\'=\'1` fait remonter le premier compte de la table', async () => {
    // Requête générée : SELECT * FROM users WHERE email = '' OR '1'='1'
    // → toutes les lignes remontent, le code prend rows[0], c'est-à-dire le
    //   compte RH (id = 1), le plus privilégié.
    const res = await request(app)
      .post('/auth/login')
      .send({ email: "' OR '1'='1", password: 'Password123!' })

    // Le mot de passe fourni est celui du compte RH : la connexion aboutit
    // alors que l'attaquant n'a JAMAIS fourni l'adresse email correspondante.
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('rh')
  })

  test('la charge utile permet de choisir précisément le compte ciblé', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: "' OR email = 'employe@novatech.io",
        password: 'Employe456!',
      })

    expect(res.status).toBe(200)

    // Le corps de la réponse renvoie l'email SOUMIS (la charge utile), pas
    // celui de la base : c'est le jeton qu'il faut inspecter pour savoir quel
    // compte a réellement été ouvert.
    expect(res.body.user.email).toBe("' OR email = 'employe@novatech.io")

    const verification = await request(app).post('/auth/verify').send({ token: res.body.token })
    expect(verification.status).toBe(200)
    expect(verification.body.user.email).toBe('employe@novatech.io')
    expect(verification.body.user.role).toBe('employe')
  })

  test('une charge utile destructrice est bien transmise au moteur (démonstration non destructrice)', async () => {
    // On ne joue PAS un DROP TABLE : on prouve que le point-virgule et la
    // syntaxe arbitraire atteignent le moteur, en provoquant une erreur SQL
    // que seul PostgreSQL peut produire.
    const couche = app._router.stack.find((l) => l.route && l.route.path === '/auth/login')
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }

    await expect(
      handler({ body: { email: "'; SELECT syntaxe_invalide_", password: 'x' } }, res, jest.fn())
    ).rejects.toThrow()

    // La table users est intacte : le jeu de données reste complet.
    const restant = await query('SELECT COUNT(*)::int AS n FROM users')
    expect(restant.rows[0].n).toBe(2)
  })

  test('le service congés, lui, résiste à la même charge utile (requêtes paramétrées)', async () => {
    // Contre-épreuve : la faille est propre au service auth, pas générale.
    const congesApp = require('../../services/conges/src/app')
    const couche = congesApp._router.stack.find(
      (l) => l.route && l.route.path === '/conges/solde/:employeeId'
    )
    const handler = couche.route.stack[0].handle
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }

    // La charge est traitée comme une VALEUR, pas comme du SQL : PostgreSQL
    // refuse la conversion en integer au lieu d'exécuter quoi que ce soit.
    await expect(
      handler({ params: { employeeId: "1' OR '1'='1" } }, res, jest.fn())
    ).rejects.toThrow(/invalid input syntax for type integer/)
  })
})

describe('POST /auth/verify — sur données réelles', () => {
  test('un jeton émis par /auth/login est accepté par /auth/verify', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'rh@novatech.io', password: 'Password123!' })

    const verify = await request(app).post('/auth/verify').send({ token: login.body.token })

    expect(verify.status).toBe(200)
    expect(verify.body.valid).toBe(true)
    expect(verify.body.user.email).toBe('rh@novatech.io')
  })
})
