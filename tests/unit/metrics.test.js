/**
 * Instrumentation Prometheus — endpoint /metrics des 5 services (L4).
 *
 * On monte chaque app en mémoire (Supertest) et on vérifie que /metrics répond
 * au format Prometheus avec les 4 golden signals. Aucune base : /metrics ne
 * touche jamais PostgreSQL.
 */
const request = require('supertest')

const services = [
  { nom: 'auth', app: require('../../services/auth/src/app') },
  { nom: 'paie', app: require('../../services/paie/src/app') },
  { nom: 'conges', app: require('../../services/conges/src/app') },
  { nom: 'recrutement', app: require('../../services/recrutement/src/app') },
  { nom: 'api-gateway', app: require('../../services/api-gateway/src/app') },
]

describe.each(services)('Instrumentation /metrics — $nom', ({ nom, app }) => {
  test('expose /metrics au format Prometheus', async () => {
    const res = await request(app).get('/metrics')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.text).toContain('http_requests_total')
    expect(res.text).toContain('http_request_duration_seconds')
  })

  test('inclut la saturation (métriques process) et le label de service', async () => {
    const res = await request(app).get('/metrics')

    // Golden signal « saturation » via collectDefaultMetrics.
    expect(res.text).toMatch(/process_cpu_seconds_total|nodejs_eventloop_lag_seconds/)
    expect(res.text).toContain(`service="${nom}"`)
  })

  test('compte une requête après un appel à /health', async () => {
    await request(app).get('/health')
    const res = await request(app).get('/metrics')

    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/health"[^}]*\}\s+\d/)
    expect(res.text).toMatch(/http_requests_total\{[^}]*status_code="200"[^}]*\}/)
  })

  test('ne se mesure pas lui-même (/metrics exclu)', async () => {
    await request(app).get('/metrics')
    const res = await request(app).get('/metrics')

    expect(res.text).not.toMatch(/route="\/metrics"/)
  })
})
