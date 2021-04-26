const logMock = jest.fn()
logMock.error = jest.fn()
logMock.warn = jest.fn()

module.exports = {
  bindings: {},
  bindingData: {},
  log: logMock
}
