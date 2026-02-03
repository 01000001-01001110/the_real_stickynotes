module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
  },
  globals: {
    api: 'readonly',
  },
  overrides: [
    {
      files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
    },
  ],
};
