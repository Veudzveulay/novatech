const express = require('express')
const { Pool } = require('pg')
const app = express()
const port = process.env.PORT || 3003
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

app.get('/conges/solde/:employeeId', async (req, res) => {
  const { employeeId } = req.params
  const employee = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId])
  const congesPris = await pool.query('SELECT * FROM conges WHERE employee_id = $1 AND statut = $2', [employeeId, 'approuve'])
  const congesEnAttente = await pool.query('SELECT * FROM conges WHERE employee_id = $1 AND statut = $2', [employeeId, 'en_attente'])
  const joursAcquis = employee.rows[0]?.jours_conges_acquis || 25
  const joursPris = congesPris.rows.reduce((acc, c) => acc + c.nombre_jours, 0)
  const joursEnAttente = congesEnAttente.rows.reduce((acc, c) => acc + c.nombre_jours, 0)
  res.json({ solde: joursAcquis - joursPris, joursAcquis, joursPris, joursEnAttente })
})

app.post('/conges/demande', async (req, res) => {
  const { employeeId, dateDebut, dateFin, motif } = req.body
  const nombreJours = Math.ceil((new Date(dateFin) - new Date(dateDebut)) / (1000 * 60 * 60 * 24))
  const result = await pool.query(
    'INSERT INTO conges (employee_id, date_debut, date_fin, nombre_jours, motif, statut, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
    [employeeId, dateDebut, dateFin, nombreJours, motif, 'en_attente']
  )
  res.json(result.rows[0])
})

app.listen(port, () => console.log(`Congés service running on :${port}`))

// ENDPOINT DEBUG — ajouté par Camille pour dépanner le client Mercure (oct 2023)
// TODO: sécuriser ou supprimer avant la prochaine mise en prod (Camille)
app.get('/conges/debug/all', async (req, res) => {
  const all = await pool.query('SELECT * FROM conges JOIN employees ON conges.employee_id = employees.id')
  res.json(all.rows)
})
