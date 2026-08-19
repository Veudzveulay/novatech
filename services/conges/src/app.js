const express = require('express')
const { pool } = require('./db')

const app = express()

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/conges/solde/:employeeId', async (req, res) => {
  const { employeeId } = req.params

  const employee = await pool.query(
    'SELECT * FROM employees WHERE id = $1',
    [employeeId]
  )

  const congesPris = await pool.query(
    'SELECT * FROM conges WHERE employee_id = $1 AND statut = $2',
    [employeeId, 'approuve']
  )

  const congesEnAttente = await pool.query(
    'SELECT * FROM conges WHERE employee_id = $1 AND statut = $2',
    [employeeId, 'en_attente']
  )

  const joursAcquis = employee.rows[0]?.jours_conges_acquis || 25
  const joursPris = congesPris.rows.reduce(
    (acc, c) => acc + c.nombre_jours,
    0
  )
  const joursEnAttente = congesEnAttente.rows.reduce(
    (acc, c) => acc + c.nombre_jours,
    0
  )

  res.json({
    solde: joursAcquis - joursPris,
    joursAcquis,
    joursPris,
    joursEnAttente,
  })
})

app.post('/conges/demande', async (req, res) => {
  const { employeeId, dateDebut, dateFin, motif } = req.body

  const nombreJours = Math.ceil(
    (new Date(dateFin) - new Date(dateDebut)) /
      (1000 * 60 * 60 * 24)
  )

  const result = await pool.query(
    'INSERT INTO conges (employee_id, date_debut, date_fin, nombre_jours, motif, statut, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
    [employeeId, dateDebut, dateFin, nombreJours, motif, 'en_attente']
  )

  res.json(result.rows[0])
})

module.exports = app
