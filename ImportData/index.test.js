const inputBindingName = 'blobContents'
const outputBindingName = 'users'

describe('ImportData function', () => {
  const importData = require('.')

  const context = require('../test/defaultContext')
  const dateNow = Date.now()
  Date.now = jest.fn(() => dateNow)

  function expectOutboundUser (input, output, importDate) {
    expect(output).toMatchObject({
      active: true,
      id: input.emailAddress,
      importDate,
      phoneNumbers: input.phoneNumbers
    })
    expect(output).not.toMatchObject({ emailAddress: input.emailAddress })
  }

  beforeEach(() => jest.clearAllMocks())

  test('incoming file contents are saved to output binding with email as id and additional props', async () => {
    const inputUsers = [{ emailAddress: 'a@a.com', phoneNumbers: ['07000111222'] }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(inputUsers))

    await importData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toHaveLength(1)
    const outputUsers = context.bindings[outputBindingName]
    expectOutboundUser(inputUsers[0], outputUsers[0], dateNow)
  })

  test('all users use the same import date', async () => {
    const inputUsers = [
      { emailAddress: 'a@a.com', phoneNumbers: ['07000111222'] },
      { emailAddress: 'b@b.com', phoneNumbers: ['07000112233'] }
    ]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(inputUsers))

    await importData(context)

    expect(Date.now).toHaveBeenCalledTimes(1)
    const outputUsers = context.bindings[outputBindingName]
    expectOutboundUser(inputUsers[0], outputUsers[0], dateNow)
    expectOutboundUser(inputUsers[1], outputUsers[1], dateNow)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(importData(context)).rejects.toThrow(Error)
    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('ImportData bindings', () => {
  const { bindings: functionBindings } = require('./function')

  const testEnvVars = require('../test/testEnvVars')
  const { allUsersFilename } = require('../lib/config')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')

    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${allUsersFilename}`)
  })

  // TODO: remove once tested with direct access to Cosmos
  test.skip('cosmos output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('cosmosDB')
    expect(binding.databaseName).toEqual('gwa')
    expect(binding.collectionName).toEqual(`%${testEnvVars.COSMOS_DB_USERS_CONTAINER}%`)
    expect(binding.connectionStringSetting).toEqual(`${testEnvVars.COSMOS_DB_CONNECTION_STRING}`)
  })
})
