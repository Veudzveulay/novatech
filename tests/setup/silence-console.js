/**
 * Neutralise les journaux des services pour garder un rapport lisible. Les
 * mocks restent inspectables : paie.test.js s'en sert pour prouver que
 * l'erreur Stripe est avalée.
 */
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})
