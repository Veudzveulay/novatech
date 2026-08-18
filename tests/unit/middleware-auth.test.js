/**
 * Middleware d'authentification de la passerelle — code mort depuis le commit
 * 06445bd, dont le message invoque « un bug de token expiration ».
 *
 * Ces tests établissent que ce bug n'existe pas : jetons valides, absents,
 * malformés, signés avec un autre secret et expirés sont tous traités
 * correctement.
 */
const jwt = require('jsonwebtoken')

const authMiddleware = require('../../services/api-gateway/src/middleware/auth')

function faireRequete(authorization) {
  return {
    headers: authorization
      ? { authorization }
      : {},
  }
}

function faireReponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

describe('Middleware auth — jetons acceptés', () => {
  test('laisse passer un jeton valide et attache l’utilisateur à la requête', () => {
    const token = jwt.sign(
      { userId: 1, role: 'rh' },
      process.env.JWT_SECRET
    )

    const req = faireRequete(`Bearer ${token}`)
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)

    expect(req.user).toMatchObject({
      userId: 1,
      role: 'rh',
    })

    expect(res.status).not.toHaveBeenCalled()
  })

  test('accepte un jeton envoyé sans le préfixe Bearer', () => {
    const token = jwt.sign(
      { userId: 1, role: 'rh' },
      process.env.JWT_SECRET
    )

    const req = faireRequete(token)
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('Middleware auth — jetons rejetés', () => {
  test('retourne 401 quand aucun en-tête Authorization n’est fourni', () => {
    const req = faireRequete()
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)

    expect(res.json).toHaveBeenCalledWith({
      error: 'No token',
    })

    expect(next).not.toHaveBeenCalled()
  })

  test('retourne 401 sur un jeton malformé', () => {
    const req = faireRequete('Bearer pas-un-jwt')
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)

    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    })

    expect(next).not.toHaveBeenCalled()
  })

  test('retourne 401 sur un jeton signé avec un autre secret', () => {
    const token = jwt.sign(
      { userId: 1 },
      'secret_de_lattaquant'
    )

    const req = faireRequete(`Bearer ${token}`)
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('CONTRE-EXPERTISE : un jeton expiré est rejeté proprement, sans exception non gérée', () => {
    const token = jwt.sign(
      {
        userId: 1,
        role: 'rh',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '-10s',
      }
    )

    const req = faireRequete(`Bearer ${token}`)
    const res = faireReponse()
    const next = jest.fn()

    expect(
      () => authMiddleware(req, res, next)
    ).not.toThrow()

    expect(res.status).toHaveBeenCalledWith(401)

    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    })

    expect(next).not.toHaveBeenCalled()
  })

  test('CONTRE-EXPERTISE : un jeton valide expirant dans 1 seconde passe encore', () => {
    const token = jwt.sign(
      {
        userId: 1,
        role: 'rh',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1s',
      }
    )

    const req = faireRequete(`Bearer ${token}`)
    const res = faireReponse()
    const next = jest.fn()

    authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('Middleware auth — dépendance à la configuration', () => {
  test('SECURITY : sans JWT_SECRET, le middleware refuse de fonctionner', () => {
    const token = jwt.sign(
      { userId: 1 },
      process.env.JWT_SECRET
    )

    const secretOriginal = process.env.JWT_SECRET

    delete process.env.JWT_SECRET

    try {
      const req = faireRequete(`Bearer ${token}`)
      const res = faireReponse()
      const next = jest.fn()

      authMiddleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(503)

      expect(next).not.toHaveBeenCalled()
    } finally {
      if (secretOriginal === undefined) {
        delete process.env.JWT_SECRET
      } else {
        process.env.JWT_SECRET = secretOriginal
      }
    }
  })
})