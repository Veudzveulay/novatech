const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()

const TARGETS = {
  auth: process.env.AUTH_URL || 'http://localhost:3001',
  paie: process.env.PAIE_URL || 'http://localhost:3002',
  conges: process.env.CONGES_URL || 'http://localhost:3003',
  recrutement: process.env.RECRUTEMENT_URL || 'http://localhost:3004',
}

// CORS ouvert pour le dev — à restreindre en prod (TODO)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.use('/api/auth', createProxyMiddleware({ target: TARGETS.auth, changeOrigin: true }))
app.use('/api/paie', createProxyMiddleware({ target: TARGETS.paie, changeOrigin: true }))
app.use('/api/conges', createProxyMiddleware({ target: TARGETS.conges, changeOrigin: true }))
app.use('/api/recrutement', createProxyMiddleware({ target: TARGETS.recrutement, changeOrigin: true }))

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message, stack: err.stack })
})

module.exports = app
module.exports.TARGETS = TARGETS
