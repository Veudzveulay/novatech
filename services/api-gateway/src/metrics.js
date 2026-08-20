const client = require('prom-client')

/**
 * Instrumentation Prometheus d'un service.
 *
 * `createMetrics(nom)` renvoie de quoi couvrir les 4 golden signals :
 *   - latence  : histogramme http_request_duration_seconds
 *   - trafic   : compteur http_requests_total
 *   - erreurs  : les deux, filtrables par label status_code
 *   - saturation : métriques par défaut du process (CPU, mémoire, event loop)
 *
 * Un registre par service (pas le registre global) : deux services importés
 * dans le même process de test n'interfèrent pas.
 */
function createMetrics(serviceName) {
  const register = new client.Registry()
  register.setDefaultLabels({ service: serviceName })

  client.collectDefaultMetrics({ register })

  const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Durée des requêtes HTTP en secondes',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  })

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Nombre total de requêtes HTTP',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  })

  // Borne la cardinalité : route paramétrée si Express l'a résolue
  // (ex. /conges/solde/:employeeId), sinon les 2 premiers segments du chemin.
  function routeLabel(req) {
    if (req.route && req.route.path) {
      return (req.baseUrl || '') + req.route.path
    }
    const segments = (req.path || '/').split('/').filter(Boolean).slice(0, 2)
    return '/' + segments.join('/')
  }

  function middleware(req, res, next) {
    if (req.path === '/metrics') return next()

    const finTimer = httpRequestDurationSeconds.startTimer()

    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: routeLabel(req),
        status_code: String(res.statusCode),
      }
      finTimer(labels)
      httpRequestsTotal.inc(labels)
    })

    next()
  }

  async function handler(req, res) {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  }

  return { register, middleware, handler }
}

module.exports = { createMetrics }
