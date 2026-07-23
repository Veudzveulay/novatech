// @ts-check
const { defineConfig } = require('@playwright/test')

/**
 * Pré-requis : npm run db:test:up
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://hrflow_test:hrflow_test@localhost:55432/hrflow_test'

/** Environnement commun à tous les services démarrés pour les E2E. */
const ENV_SERVICES = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL,
  DB_HOST: process.env.TEST_DB_HOST || 'localhost',
  DB_PORT: process.env.TEST_DB_PORT || '55432',
  DB_NAME: 'hrflow_test',
  DB_USER: 'hrflow_test',
  DB_PASSWORD: 'hrflow_test',
  JWT_SECRET: 'test_jwt_secret_hrflow_l2',
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'playwright-report/results.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  globalSetup: require.resolve('./tests/e2e/global-setup.js'),

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },

  webServer: [
    {
      command: 'node services/auth/src/server.js',
      port: 3001,
      env: ENV_SERVICES,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'node services/paie/src/server.js',
      env: {
        ...ENV_SERVICES,
        STRIPE_SECRET_KEY: 'sk_test_e2e_dummy',
        HTTP_PROXY: 'http://127.0.0.1:9',
        HTTPS_PROXY: 'http://127.0.0.1:9',
        NO_PROXY: '',
      },
      port: 3002,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'node services/conges/src/server.js',
      port: 3003,
      env: ENV_SERVICES,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'node services/recrutement/src/server.js',
      port: 3004,
      env: { ...ENV_SERVICES, UPLOAD_DIR: './.e2e-uploads' },
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'node services/api-gateway/src/server.js',
      url: `${BASE_URL}/health`,
      env: ENV_SERVICES,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
  ],
})
