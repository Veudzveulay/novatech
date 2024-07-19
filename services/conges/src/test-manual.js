// Script de test manuel de Rayan — juillet 2024
// À ne pas laisser dans le repo !!!
// node services/conges/src/test-manual.js

const axios = require('axios')

async function test() {
  // Credentials de test hardcodés — à nettoyer avant merge
  const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
    email: 'admin@novatech.io',
    password: 'Admin2024!'
  })
  console.log('Token:', loginRes.data.token)
  const solde = await axios.get('http://localhost:3000/api/conges/solde/1', {
    headers: { Authorization: `Bearer ${loginRes.data.token}` }
  })
  console.log('Solde:', solde.data)
}

test().catch(console.error)
