const app = require('./app')

const PORT = process.env.PAIE_PORT || 3002

app.listen(PORT, () => console.log(`Paie service running on :${PORT}`))
