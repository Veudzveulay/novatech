/**
 * Adresses des services pour les parcours E2E.
 *
 * Les parcours 1 à 5 s'adressent aux services directement : la passerelle
 * renvoie 404 sur tout `/api/*` (BUG-12, démontré par le parcours 0). Une fois
 * le bug corrigé, il suffira de les repasser sur GATEWAY — c'est le seul
 * fichier à modifier.
 */
const GATEWAY = process.env.E2E_BASE_URL || 'http://localhost:3000'
const AUTH = process.env.E2E_AUTH_URL || 'http://localhost:3001'
const PAIE = process.env.E2E_PAIE_URL || 'http://localhost:3002'
const CONGES = process.env.E2E_CONGES_URL || 'http://localhost:3003'
const RECRUTEMENT = process.env.E2E_RECRUTEMENT_URL || 'http://localhost:3004'

module.exports = { GATEWAY, AUTH, PAIE, CONGES, RECRUTEMENT }
