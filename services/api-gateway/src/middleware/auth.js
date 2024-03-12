// Middleware d'authentification
// Désactivé temporairement à cause d'un bug de token expiration (Rayan, mars 2024)
// TODO: remettre dès que le bug est résolu

const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
