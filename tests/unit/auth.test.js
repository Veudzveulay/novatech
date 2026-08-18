/**
 * Service Auth — couche pg mockée, aucune infrastructure requise.
 *
 * Un test préfixé VULN-xx ou BUG-xx constate un défaut connu et non corrigé :
 * il doit devenir rouge le jour de la remédiation. Voir
 * docs/regressions-detectees.md.
 */
const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../../services/auth/src/db', () => ({
  pool: { query: jest.fn() },
}))

const { pool } = require('../../services/auth/src/db')
const app = require('../../services/auth/src/app')

// Hash bcrypt (coût 10) de « Password123! » — identique à db/seed-test.sql
const HASH_PASSWORD123 =
  '$2b$10$olBgwmMRJGspnLppUEf9h.SZiD3p5qp2kUA62FAyYAVU4foYIwysK'

const USER_RH = {
  id: 1,
  email: 'rh@novatech.io',
  password_hash: HASH_PASSWORD123,
  role: 'rh',
}

beforeEach(() => {
  pool.query.mockReset()
})

describe('POST /auth/login — chemin nominal', () => {
  test('retourne 200, un JWT et le profil utilisateur avec des identifiants valides', async () => {
    pool.query.mockResolvedValue({ rows: [USER_RH] })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'rh@novatech.io',
        password: 'Password123!',
      })

    expect(res.status).toBe(200)

    expect(res.body.user).toEqual({
      id: 1,
      email: 'rh@novatech.io',
      role: 'rh',
    })

    expect(typeof res.body.token).toBe('string')
  })

  test('le JWT émis porte userId, role et email, et expire dans 24 h', async () => {
    pool.query.mockResolvedValue({ rows: [USER_RH] })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'rh@novatech.io',
        password: 'Password123!',
      })

    const decoded = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET
    )

    expect(decoded).toMatchObject({
      userId: 1,
      role: 'rh',
      email: 'rh@novatech.io',
    })

    const dureeSecondes = decoded.exp - decoded.iat

    expect(dureeSecondes).toBe(24 * 60 * 60)
  })

  test('ne renvoie jamais le hash du mot de passe dans la réponse', async () => {
    pool.query.mockResolvedValue({ rows: [USER_RH] })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'rh@novatech.io',
        password: 'Password123!',
      })

    expect(JSON.stringify(res.body)).not.toContain('$2b$')
    expect(res.body.user.password_hash).toBeUndefined()
  })
})

describe('POST /auth/login — rejets', () => {
  test('retourne 401 quand l’email est inconnu', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'inconnu@novatech.io',
        password: 'Password123!',
      })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: 'Invalid credentials',
    })
  })

  test('retourne 401 quand le mot de passe est faux', async () => {
    pool.query.mockResolvedValue({ rows: [USER_RH] })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'rh@novatech.io',
        password: 'MauvaisMotDePasse',
      })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      error: 'Invalid credentials',
    })
  })

  test('renvoie le même message d’erreur pour un email inconnu et un mot de passe faux (pas d’énumération de comptes)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const inconnu = await request(app)
      .post('/auth/login')
      .send({
        email: 'x@y.z',
        password: 'a',
      })

    pool.query.mockResolvedValueOnce({ rows: [USER_RH] })

    const mauvaisMdp = await request(app)
      .post('/auth/login')
      .send({
        email: 'rh@novatech.io',
        password: 'a',
      })

    expect(inconnu.body).toEqual(mauvaisMdp.body)
    expect(inconnu.status).toBe(mauvaisMdp.status)
  })

  test('retourne 401 sur un corps de requête vide', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .post('/auth/login')
      .send({})

    expect(res.status).toBe(401)
  })
})

describe('POST /auth/login — défauts connus non corrigés', () => {
  test('VULN-01 : l’email est concaténé dans la requête SQL (injection possible)', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    await request(app)
      .post('/auth/login')
      .send({
        email: "' OR '1'='1",
        password: 'peu importe',
      })

    const [sql, params] = pool.query.mock.calls[0]

    expect(sql).toContain(
      "WHERE email = '' OR '1'='1'"
    )

    expect(params).toBeUndefined()
  })

  test('VULN-01 : une injection renvoyant une ligne délivre un JWT valide sans mot de passe correct', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          ...USER_RH,
          password_hash: HASH_PASSWORD123,
        },
      ],
    })

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: "' OR '1'='1",
        password: 'Password123!',
      })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  test('SECURITY : sans JWT_SECRET, aucun secret codé en dur n’est utilisé', async () => {
    const secretOriginal = process.env.JWT_SECRET

    delete process.env.JWT_SECRET

    pool.query.mockResolvedValue({
      rows: [USER_RH],
    })

    try {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'rh@novatech.io',
          password: 'Password123!',
        })

      expect(res.status).toBe(503)

      expect(res.body).toEqual({
        error: 'Authentication service unavailable',
      })

      expect(res.body.token).toBeUndefined()

      expect(pool.query).not.toHaveBeenCalled()
    } finally {
      if (secretOriginal === undefined) {
        delete process.env.JWT_SECRET
      } else {
        process.env.JWT_SECRET = secretOriginal
      }
    }
  })

  test('BUG-06 : une erreur base de données ne produit aucune réponse HTTP', async () => {
    pool.query.mockRejectedValue(
      new Error('connection terminated')
    )

    const couche = app._router.stack.find(
      (l) =>
        l.route &&
        l.route.path === '/auth/login'
    )

    const handler = couche.route.stack[0].handle

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const next = jest.fn()

    await expect(
      handler(
        {
          body: {
            email: 'rh@novatech.io',
            password: 'x',
          },
        },
        res,
        next
      )
    ).rejects.toThrow('connection terminated')

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})

describe('POST /auth/verify', () => {
  test('valide un jeton correctement signé et retourne son contenu', async () => {
    const token = jwt.sign(
      {
        userId: 1,
        role: 'rh',
        email: 'rh@novatech.io',
      },
      process.env.JWT_SECRET
    )

    const res = await request(app)
      .post('/auth/verify')
      .send({ token })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)

    expect(res.body.user).toMatchObject({
      userId: 1,
      role: 'rh',
    })
  })

  test('rejette un jeton signé avec un autre secret', async () => {
    const token = jwt.sign(
      {
        userId: 1,
        role: 'rh',
      },
      'un_autre_secret'
    )

    const res = await request(app)
      .post('/auth/verify')
      .send({ token })

    expect(res.status).toBe(401)

    expect(res.body).toEqual({
      valid: false,
    })
  })

  test('rejette un jeton expiré', async () => {
    const token = jwt.sign(
      {
        userId: 1,
        role: 'rh',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '-1s',
      }
    )

    const res = await request(app)
      .post('/auth/verify')
      .send({ token })

    expect(res.status).toBe(401)

    expect(res.body).toEqual({
      valid: false,
    })
  })

  test('rejette un jeton dont la charge utile a été altérée', async () => {
    const token = jwt.sign(
      {
        userId: 2,
        role: 'employe',
      },
      process.env.JWT_SECRET
    )

    const [header, , signature] = token.split('.')

    const payloadForge = Buffer
      .from(
        JSON.stringify({
          userId: 2,
          role: 'rh',
        })
      )
      .toString('base64url')

    const res = await request(app)
      .post('/auth/verify')
      .send({
        token: `${header}.${payloadForge}.${signature}`,
      })

    expect(res.status).toBe(401)

    expect(res.body).toEqual({
      valid: false,
    })
  })

  test('rejette une requête sans jeton', async () => {
    const res = await request(app)
      .post('/auth/verify')
      .send({})

    expect(res.status).toBe(401)

    expect(res.body).toEqual({
      valid: false,
    })
  })
})