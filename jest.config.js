/**
 * Jest Configuration
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/test/unit/database/modules/'],
  collectCoverageFrom: [
    'shared/utils/**/*.js',
    'shared/constants/**/*.js',
    'shared/crypto.js',
    'shared/database/migrations/**/*.js',
    'shared/logging/**/*.js',
    'cli/output/**/*.js',
    'electron/cli/commands.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['./test/setup.js'],
  testTimeout: 10000,
  verbose: true,
};
