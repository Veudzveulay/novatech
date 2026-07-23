/**
 * Environnement de test. Le `.env` du dépôt n'est jamais chargé : il contient
 * des secrets de production (commit 24b295b).
 */
process.env.NODE_ENV = 'test'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_hrflow_l2'

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_do_not_use'

// Port 55432 en local (docker-compose.test.yml), 5432 en CI.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test'

// Le service auth utilise des variables séparées (pas de connectionString).
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost'
process.env.DB_PORT = process.env.TEST_DB_PORT || '55432'
process.env.DB_NAME = 'hrflow_test'
process.env.DB_USER = 'hrflow_test'
process.env.DB_PASSWORD = 'hrflow_test'

// Répertoire d'upload isolé pour le service recrutement.
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'hrflow-test-uploads')
require('fs').mkdirSync(process.env.UPLOAD_DIR, { recursive: true })
