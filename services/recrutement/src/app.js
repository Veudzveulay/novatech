const express = require('express')
const multer = require('multer')
const { pool } = require('./db')

const app = express()

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Upload CV
const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || '/tmp/uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage })

app.post('/recrutement/candidat', upload.single('cv'), async (req, res) => {
  const { nom, prenom, email, poste } = req.body

  const result = await pool.query(
    'INSERT INTO candidats (nom, prenom, email, poste, cv_path, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [nom, prenom, email, poste, req.file?.path]
  )

  res.json(result.rows[0])
})

app.get('/recrutement/candidats', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM candidats ORDER BY created_at DESC'
  )

  res.json(result.rows)
})

app.patch('/recrutement/candidat/:id/statut', async (req, res) => {
  const { id } = req.params
  const { statut } = req.body

  await pool.query(
    'UPDATE candidats SET statut = $1 WHERE id = $2',
    [statut, id]
  )

  res.json({ success: true })
})

module.exports = app