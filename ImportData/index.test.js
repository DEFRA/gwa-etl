const testEnvVars = require('../test/testEnvVars')

const inputBindingName = 'blobContents'
const outputBindingName = 'users'

describe('ImportData function', () => {
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

  let importData
  let CosmosClient
  let containerMock
  let createMock
  let fetchAllMock
  let itemMock
  let queryMock
  let readMock
  let replaceMock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    CosmosClient = require('@azure/cosmos').CosmosClient
    jest.mock('@azure/cosmos')

    createMock = jest.fn()
    fetchAllMock = jest.fn()
    readMock = jest.fn()
    replaceMock = jest.fn()
    itemMock = jest.fn(() => { return { read: readMock, replace: replaceMock } })
    queryMock = jest.fn(() => { return { fetchAll: fetchAllMock } })
    containerMock = jest.fn(() => {
      return {
        item: itemMock,
        items: {
          create: createMock,
          query: queryMock
        }
      }
    })
    CosmosClient.prototype.database.mockImplementation(() => {
      return { container: containerMock }
    })

    importData = require('.')
  })

  test('Cosmos client is correctly created on module import', async () => {
    expect(CosmosClient).toHaveBeenCalledTimes(1)
    expect(CosmosClient).toHaveBeenCalledWith(testEnvVars.COSMOS_DB_CONNECTION_STRING)
    const databaseMock = CosmosClient.mock.instances[0].database
    expect(databaseMock).toHaveBeenCalledTimes(1)
    expect(databaseMock).toHaveBeenCalledWith(testEnvVars.COSMOS_DB_NAME)
    expect(containerMock).toHaveBeenCalledTimes(1)
    expect(containerMock).toHaveBeenCalledWith(testEnvVars.COSMOS_DB_USERS_CONTAINER)
  })

  test('no users to import results in no db querying', async () => {
    const usersToImport = []
    context.bindings[inputBindingName] = JSON.stringify(usersToImport)

    await importData(context)

    expect(context.log.warn).toHaveBeenCalledTimes(1)
    expect(context.log.warn).toHaveBeenCalledWith('No users to import, returning early.')
  })

  test('an item to import with an existing record is updated (movers or no change)', async () => {
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser' }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    readMock.mockResolvedValueOnce({ resource: existingUsers[0] })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp', sharedProp: 'importUser' }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(usersToImport))

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT c.id FROM c')
    expect(itemMock).toHaveBeenCalledTimes(2)
    const emailAddress = usersToImport[0].emailAddress
    expect(itemMock).toHaveBeenCalledWith(emailAddress, emailAddress)
    expect(readMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      existingProp: existingUsers[0].existingProp,
      id: existingUsers[0].id,
      importDate: dateNow,
      newProp: usersToImport[0].newProp,
      sharedProp: usersToImport[0].sharedProp
    }))
  })

  test('an item to import with no existing record is created (joiners)', async () => {
    const existingUsers = []
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    readMock.mockResolvedValueOnce({ })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp', sharedProp: 'importUser' }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(usersToImport))

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT c.id FROM c')
    expect(itemMock).toHaveBeenCalledTimes(1)
    const emailAddress = usersToImport[0].emailAddress
    expect(itemMock).toHaveBeenCalledWith(emailAddress, emailAddress)
    expect(readMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      id: usersToImport[0].emailAddress,
      importDate: dateNow,
      newProp: usersToImport[0].newProp,
      sharedProp: usersToImport[0].sharedProp
    }))
    expect(createMock.mock.calls[0]).not.toHaveProperty('existingProp')
  })

  test('an existing record with no item to import is set inactive (leavers)', async () => {
    const previousImportDate = 12345567890
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser', importDate: previousImportDate }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    readMock.mockResolvedValueOnce({ })
    readMock.mockResolvedValueOnce({ resource: existingUsers[0] })
    const usersToImport = [{ emailAddress: 'b@b.com', newProp: 'newProp', sharedProp: 'importUser' }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(usersToImport))

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT c.id FROM c')
    expect(itemMock).toHaveBeenCalledTimes(3)
    const emailAddress = usersToImport[0].emailAddress
    expect(itemMock).toHaveBeenCalledWith(emailAddress, emailAddress)
    expect(readMock).toHaveBeenCalledTimes(2)
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(expect.objectContaining({
      active: false,
      existingProp: existingUsers[0].existingProp,
      id: existingUsers[0].id,
      importDate: previousImportDate,
      sharedProp: existingUsers[0].sharedProp
    }))
  })

  test.skip('incoming file contents are saved to output binding with email as id and additional props', async () => {
    const inputUsers = [{ emailAddress: 'a@a.com', phoneNumbers: ['07000111222'] }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(inputUsers))

    await importData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toHaveLength(1)
    const outputUsers = context.bindings[outputBindingName]
    expectOutboundUser(inputUsers[0], outputUsers[0], dateNow)
  })

  test.skip('all users use the same import date', async () => {
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
