const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const app = express()

// CORS ouvert pour le dev — à restreindre en prod (TODO)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.use('/api/auth', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }))
app.use('/api/paie', createProxyMiddleware({ target: 'http://localhost:3002', changeOrigin: true }))
app.use('/api/conges', createProxyMiddleware({ target: 'http://localhost:3003', changeOrigin: true }))
app.use('/api/recrutement', createProxyMiddleware({ target: 'http://localhost:3004', changeOrigin: true }))

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message, stack: err.stack })
})

app.listen(3000, () => {
  console.log('API Gateway running on :3000')
  console.log('JWT_SECRET:', process.env.JWT_SECRET)
})
