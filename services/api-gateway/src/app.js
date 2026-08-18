const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()

const TARGETS = {
  auth: process.env.AUTH_SERVICE_URL || process.env.AUTH_URL || 'http://localhost:3001',
  paie: process.env.PAIE_SERVICE_URL || process.env.PAIE_URL || 'http://localhost:3002',
  conges: process.env.CONGES_SERVICE_URL || process.env.CONGES_URL || 'http://localhost:3003',
  recrutement: process.env.RECRUTEMENT_SERVICE_URL || process.env.RECRUTEMENT_URL || 'http://localhost:3004',
}

const FEATURE_RECRUITMENT_ENABLED = process.env.FEATURE_RECRUITMENT_ENABLED !== 'false'

const CORS_ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.disable('x-powered-by')

app.use((req, res, next) => {
  const origin = req.get('Origin')

  if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Vary', 'Origin')
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type')
  res.header('Cache-Control', 'no-store')
  res.header(
    'Content-Security-Policy',
    "default-src 'none'; base-uri 'none'; child-src 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; img-src 'none'; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'none'; style-src 'none'; worker-src 'none'",
  )
  res.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  res.header('X-Content-Type-Options', 'nosniff')
  res.header('X-Frame-Options', 'DENY')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

app.use('/api/auth', createProxyMiddleware({ target: TARGETS.auth, changeOrigin: true }))
app.use('/api/paie', createProxyMiddleware({ target: TARGETS.paie, changeOrigin: true }))
app.use('/api/conges', createProxyMiddleware({ target: TARGETS.conges, changeOrigin: true }))
if (FEATURE_RECRUITMENT_ENABLED) {
  app.use('/api/recrutement', createProxyMiddleware({ target: TARGETS.recrutement, changeOrigin: true }))
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message, stack: err.stack })
})

module.exports = app
module.exports.TARGETS = TARGETS
module.exports.FEATURE_RECRUITMENT_ENABLED = FEATURE_RECRUITMENT_ENABLED
module.exports.CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS
