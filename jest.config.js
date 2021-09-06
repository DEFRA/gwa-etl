module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    './**/*.js',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  setupFiles: ['./jest.setup.js']
}
