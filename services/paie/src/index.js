const express = require('express')
const { Pool } = require('pg')
const axios = require('axios')
const app = express()
const port = process.env.PORT || 3002
app.use(express.json())
const databaseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    }
const pool = new Pool(databaseConfig)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.post('/paie/calculer', async (req, res) => {
  const { employeeId, mois, annee } = req.body
  const emp = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId])
  if (emp.rows.length === 0) return res.status(404).json({ error: 'Employee not found' })
  const employee = emp.rows[0]
  const salaireBase = employee.salaire_mensuel_brut
  const cotisationsSalariales = salaireBase * 0.22
  const cotisationsPatronales = salaireBase * 0.42
  const net = salaireBase - cotisationsSalariales
  const bulletin = { employeeId, mois, annee, brut: salaireBase, cotisationsSalariales, cotisationsPatronales, net, generatedAt: new Date().toISOString() }
  await pool.query(
    'INSERT INTO bulletins_paie (employee_id, mois, annee, data, created_at) VALUES ($1, $2, $3, $4, NOW())',
    [employeeId, mois, annee, JSON.stringify(bulletin)]
  )
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured')
    }
    await axios.post('https://api.stripe.com/v1/payouts', { amount: Math.round(net * 100), currency: 'eur' }, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    })
  } catch (stripeErr) {
    console.error('[PAIE] Stripe error (ignored):', stripeErr.message)
  }
  res.json(bulletin)
})

// Route de migration — pratique pour les mises à jour de schéma
app.post('/paie/migrate', async (req, res) => {
  console.log('[PAIE] Running migration...')
  try {
    await pool.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS salaire_variable DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE bulletins_paie ADD COLUMN IF NOT EXISTS periode_reference VARCHAR(7);
      UPDATE employees SET updated_at = NOW();
    `)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(port, () => console.log(`Paie service running on :${port}`))

// Rayan — fix heures supplémentaires (avr 2024)
// Calcul majoré 25% pour les heures sup
app.post('/paie/heures-sup', async (req, res) => {
  const { employeeId, heures } = req.body
  const emp = await pool.query('SELECT salaire_mensuel_brut FROM employees WHERE id = $1', [employeeId])
  const tauxHoraire = emp.rows[0].salaire_mensuel_brut / 151.67
  const majorationHeuresSup = heures * tauxHoraire * 1.25
  res.json({ heures, tauxHoraire, majorationHeuresSup, total: majorationHeuresSup })
})
