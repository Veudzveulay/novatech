const app = require('./app')

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`API Gateway running on :${PORT}`)
  console.log('JWT_SECRET:', process.env.JWT_SECRET)
})
