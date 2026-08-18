/**
 * API Gateway.
 *
 * http-proxy-middleware est remplacé par un double : on teste le montage des
 * routes et les en-têtes, pas le proxy. Conséquence assumée — BUG-12 (la
 * passerelle ne réécrit pas le chemin) est invisible ici, seuls les E2E le
 * voient.
 */
const request = require('supertest')

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn((options) => (req, res, next) => {
    if (req.headers['x-simuler-erreur']) {
      return next(new Error(`ECONNREFUSED ${options.target}`))
    }
    res.json({
      proxyAtteint: true,
      cible: options.target,
      chemin: req.url,
      autorisationRecue: req.headers.authorization || null,
    })
  }),
}))

const { createProxyMiddleware } = require('http-proxy-middleware')
const app = require('../../services/api-gateway/src/app')

// Les proxys sont instanciés au chargement du module, donc avant le premier
// test. On fige leur configuration ici : `clearMocks` effacerait l'historique
// des appels avant que le premier `test()` ne s'exécute.
const CONFIGS_PROXY = createProxyMiddleware.mock.calls.map(([options]) => options)

describe('GET /health', () => {
  test('répond 200 avec un statut ok', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  test('BUG-10 : la sonde de santé ne vérifie rien, elle répond ok même si tous les services sont morts', async () => {
    // Aucune dépendance n'est vérifiée : ni base, ni services amont. Une sonde
    // qui ne peut pas échouer rendra le Blue/Green du L3 aveugle.
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(Object.keys(res.body)).toEqual(['status'])
  })
})

describe('Routage vers les services', () => {
  test.each([
    ['/api/auth/login', 'http://localhost:3001'],
    ['/api/paie/calculer', 'http://localhost:3002'],
    ['/api/conges/solde/1', 'http://localhost:3003'],
    ['/api/recrutement/candidats', 'http://localhost:3004'],
  ])('%s est routé vers %s', async (chemin, cibleAttendue) => {
    const res = await request(app).get(chemin)

    expect(res.status).toBe(200)
    expect(res.body.cible).toBe(cibleAttendue)
  })

  test('les 4 proxys sont déclarés avec changeOrigin', () => {
    expect(CONFIGS_PROXY).toHaveLength(4)
    for (const options of CONFIGS_PROXY) {
      expect(options.changeOrigin).toBe(true)
    }
  })

  test('une route inconnue retourne 404', async () => {
    const res = await request(app).get('/pas-une-route')

    expect(res.status).toBe(404)
    expect(res.type).toMatch(/json/)
    expect(res.body).toEqual({ error: 'Not Found' })
  })

  test('les cibles sont surchargeables par variables d’environnement (nécessaire au docker-compose du L1)', () => {
    jest.isolateModules(() => {
      process.env.AUTH_URL = 'http://auth:3001'
      const appIsole = require('../../services/api-gateway/src/app')
      expect(appIsole.TARGETS.auth).toBe('http://auth:3001')
      delete process.env.AUTH_URL
    })
  })

  test('le feature flag désactive la route recrutement', async () => {
    process.env.FEATURE_RECRUITMENT_ENABLED = 'false'
    let appIsole
    jest.isolateModules(() => {
      appIsole = require('../../services/api-gateway/src/app')
    })
    const res = await request(appIsole).get('/api/recrutement/candidats')
    delete process.env.FEATURE_RECRUITMENT_ENABLED

    expect(res.status).toBe(404)
  })
})

describe('Sécurité de la passerelle — défauts connus', () => {
  test('VULN-05 : aucune route /api n’exige de jeton, la requête est relayée sans en-tête Authorization', async () => {
    const res = await request(app).get('/api/paie/calculer') // aucun jeton fourni

    expect(res.status).toBe(200)
    expect(res.body.proxyAtteint).toBe(true)
    expect(res.body.autorisationRecue).toBeNull()
  })

  test('VULN-05 : un jeton manifestement invalide ne bloque pas non plus', async () => {
    const res = await request(app)
      .get('/api/conges/debug/all')
      .set('Authorization', 'Bearer ceci-nest-pas-un-jwt')

    expect(res.status).toBe(200)
    expect(res.body.proxyAtteint).toBe(true)
  })

  test('VULN-09 corrigée : le CORS refuse une origine non autorisée', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://site-malveillant.example')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-methods']).not.toBe('*')
    expect(res.headers['access-control-allow-headers']).not.toBe('*')
  })

  test('VULN-09 corrigée : le CORS accepte une origine de la liste blanche', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(res.headers.vary).toContain('Origin')
  })

  test('les réponses API interdisent le cache et appliquent une CSP complète', async () => {
    const res = await request(app).get('/health')

    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-security-policy']).toContain("script-src 'none'")
    expect(res.headers['content-security-policy']).toContain("style-src 'none'")
  })

  test('VULN-10 : le gestionnaire d’erreurs renvoie la trace d’exécution au client', async () => {
    const res = await request(app).get('/api/auth/login').set('x-simuler-erreur', '1')

    expect(res.status).toBe(500)
    expect(res.body.error).toContain('ECONNREFUSED')
    expect(res.body.stack).toContain('Error: ECONNREFUSED')
    expect(res.body.stack).toMatch(/\n\s+at /)
  })
})
