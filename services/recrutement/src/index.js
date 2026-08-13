const express = require('express')
const multer = require('multer')
const os = require('os')
const path = require('path')
const { Pool } = require('pg')
const app = express()
const port = process.env.PORT || 3004
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

// Upload CV sans validation du type (Rayan — sept 2023)
const storage = multer.diskStorage({
  destination: path.join(os.tmpdir(), 'uploads'),
  filename: (req, file, cb) => { cb(null, file.originalname) }
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
  const result = await pool.query('SELECT * FROM candidats ORDER BY created_at DESC')
  res.json(result.rows)
})

app.patch('/recrutement/candidat/:id/statut', async (req, res) => {
  const { id } = req.params
  const { statut } = req.body
  await pool.query('UPDATE candidats SET statut = $1 WHERE id = $2', [statut, id])
  res.json({ success: true })
})

app.listen(port, () => console.log(`Recrutement service running on :${port}`))
