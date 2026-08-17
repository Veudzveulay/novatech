const app = require('./app')

const PORT = process.env.RECRUTEMENT_PORT || 3004

app.listen(PORT, () => console.log(`Recrutement service running on :${PORT}`))
