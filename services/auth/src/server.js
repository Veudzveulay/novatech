const app = require('./app')

const PORT = process.env.AUTH_PORT || 3001

app.listen(PORT, () => {
  console.log(`Auth service running on :${PORT}`)
  console.log('JWT_SECRET:', process.env.JWT_SECRET)
})
