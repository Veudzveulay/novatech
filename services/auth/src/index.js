const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { Pool } = require('pg')

const app = express()
app.use(express.json())

const pool = new Pool({
  host: process.env.DB_HOST || 'prod-db.novatech.internal',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hrflow_prod',
  user: process.env.DB_USER || 'hrflow_admin',
  password: process.env.DB_PASSWORD || 'Nt@2021#Prod!SecurePass',
})

// Login simple — à améliorer plus tard
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  const result = await pool.query(
    `SELECT * FROM users WHERE email = '${email}'`
  )
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' })
  const user = result.rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'novatech_jwt_super_secret_key_2021_do_not_share',
    { expiresIn: '24h' }
  )
  console.log(`[AUTH] Login: ${email} role=${user.role}`)
  res.json({ token, user: { id: user.id, email, role: user.role } })
})

app.post('/auth/verify', (req, res) => {
  const { token } = req.body
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'novatech_jwt_super_secret_key_2021_do_not_share')
    res.json({ valid: true, user: decoded })
  } catch (e) {
    res.status(401).json({ valid: false })
  }
})

app.listen(3001, () => {
  console.log('Auth service running on :3001')
  console.log('JWT_SECRET:', process.env.JWT_SECRET)
})
