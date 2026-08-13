const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const app = express()
const port = process.env.PORT || 3000

const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  paie: process.env.PAIE_SERVICE_URL || 'http://localhost:3002',
  conges: process.env.CONGES_SERVICE_URL || 'http://localhost:3003',
  recrutement: process.env.RECRUTEMENT_SERVICE_URL || 'http://localhost:3004',
}

// CORS ouvert pour le dev — à restreindre en prod (TODO)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.use('/api/auth', createProxyMiddleware({ target: serviceUrls.auth, changeOrigin: true }))
app.use('/api/paie', createProxyMiddleware({ target: serviceUrls.paie, changeOrigin: true }))
app.use('/api/conges', createProxyMiddleware({ target: serviceUrls.conges, changeOrigin: true }))
app.use('/api/recrutement', createProxyMiddleware({ target: serviceUrls.recrutement, changeOrigin: true }))

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message, stack: err.stack })
})

app.listen(port, () => console.log(`API Gateway running on :${port}`))
