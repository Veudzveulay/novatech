/**
 * Service Auth sur un vrai PostgreSQL — npm run db:test:up requis.
 *
 * Vérifie notamment que les charges SQL restent de simples valeurs.
 */
const request = require('supertest')

const { resetDatabase, closePool } = require('../helpers/db')
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

describe('Protection contre les injections SQL', () => {
  test('traite une charge SQL comme une simple valeur email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: "' OR '1'='1", password: 'Password123!' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid credentials' })
  })

  test('ne permet pas de sélectionner un compte avec une expression SQL', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: "' OR email = 'employe@novatech.io",
        password: 'Employe456!',
      })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid credentials' })
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
