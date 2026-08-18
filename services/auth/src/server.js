const app = require('./app')

const PORT = process.env.AUTH_PORT || 3001

app.listen(PORT, () => {
  console.log(`Auth service running on :${PORT}`)
})
