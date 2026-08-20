const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { pool } = require('./db')
const { createMetrics } = require('./metrics')

const app = express()
const metrics = createMetrics('auth')

app.use(express.json())
app.use(metrics.middleware)

// Health check utilisé par ECS / ALB
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Exposition des métriques Prometheus (scrapé par le stack de monitoring L4)
app.get('/metrics', metrics.handler)

// Login
app.post('/auth/login', async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({
      error: 'Authentication service unavailable',
    })
  }

  const { email, password } = req.body

  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  )

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const user = result.rows[0]

  const valid = await bcrypt.compare(password, user.password_hash)

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )

  console.log(`[AUTH] Login: ${email} role=${user.role}`)

  res.json({
    token,
    user: {
      id: user.id,
      email,
      role: user.role,
    },
  })
})

app.post('/auth/verify', (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({
      error: 'Authentication service unavailable',
    })
  }

  const { token } = req.body

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    res.json({
      valid: true,
      user: decoded,
    })
  } catch (e) {
    res.status(401).json({ valid: false })
  }
})

module.exports = app
