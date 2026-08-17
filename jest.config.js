module.exports = {
  testTimeout: 20000,

  maxWorkers: 1,

  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup/env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/silence-console.js'],
      clearMocks: true,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup/env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/silence-console.js'],
      globalSetup: '<rootDir>/tests/setup/global-setup.js',
    },
  ],

  collectCoverageFrom: [
    'services/*/src/**/*.js',
    '!services/*/src/server.js',
    '!services/*/src/db.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary', 'cobertura'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
}
