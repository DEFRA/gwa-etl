const testEnvVars = require('../test/testEnvVars')

const inputBindingName = 'blobContents'

describe('ImportData function', () => {
  const context = require('../test/defaultContext')
  const importDate = Date.now()
  Date.now = jest.fn(() => importDate)

  let importData
  let CosmosClient
  let bulkMock
  let containerMock
  let fetchAllMock
  let queryMock

  function bindUsersForImport (users) {
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(users))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    CosmosClient = require('@azure/cosmos').CosmosClient
    jest.mock('@azure/cosmos')

    bulkMock = jest.fn()
    fetchAllMock = jest.fn()
    queryMock = jest.fn(() => { return { fetchAll: fetchAllMock } })
    containerMock = jest.fn(() => {
      return {
        items: {
          bulk: bulkMock,
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
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(context.log.warn).toHaveBeenCalledTimes(1)
    expect(context.log.warn).toHaveBeenCalledWith('No users to import, returning early.')
  })

  test('an item to import with an existing record is updated (movers or no change)', async () => {
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser' }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT * FROM c')
    expect(bulkMock).toHaveBeenCalledTimes(1)
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining([{
      operationType: 'Upsert',
      partitionKey: existingUsers[0].id,
      resourceBody: expect.objectContaining({
        active: true,
        existingProp: existingUsers[0].existingProp,
        id: existingUsers[0].id,
        importDate,
        newProp: usersToImport[0].newProp,
        sharedProp: usersToImport[0].sharedProp
      })
    }]))
    expect(context.log).toHaveBeenNthCalledWith(1, `Users to import: ${usersToImport.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(2, `Users already existing: ${existingUsers.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(3, 'Running bulk operation for users in batch group 1 to 100.')
    expect(context.log).toHaveBeenNthCalledWith(4, '0 user(s) created: .')
    expect(context.log).toHaveBeenNthCalledWith(5, `1 user(s) updated: ${existingUsers[0].id}.`)
    expect(context.log).toHaveBeenNthCalledWith(6, '0 user(s) inactive: .')
  })

  test('an item to import with no existing record is created (joiners)', async () => {
    const existingUsers = []
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT * FROM c')
    expect(bulkMock).toHaveBeenCalledTimes(1)
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining([{
      operationType: 'Upsert',
      partitionKey: usersToImport[0].emailAddress,
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[0].emailAddress,
        importDate,
        newProp: usersToImport[0].newProp,
        sharedProp: usersToImport[0].sharedProp
      })
    }]))
    expect(context.log).toHaveBeenNthCalledWith(1, `Users to import: ${usersToImport.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(2, `Users already existing: ${existingUsers.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(3, 'Running bulk operation for users in batch group 1 to 100.')
    expect(context.log).toHaveBeenNthCalledWith(4, `1 user(s) created: ${usersToImport[0].emailAddress}.`)
    expect(context.log).toHaveBeenNthCalledWith(5, '0 user(s) updated: .')
    expect(context.log).toHaveBeenNthCalledWith(6, '0 user(s) inactive: .')
  })

  test('an existing record with no item to import is set inactive (leavers)', async () => {
    const previousImportDate = 12345567890
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser', importDate: previousImportDate }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'b@b.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT * FROM c')
    expect(bulkMock).toHaveBeenCalledTimes(1)
    const expected = [{
      operationType: 'Upsert',
      partitionKey: existingUsers[0].id,
      resourceBody: expect.objectContaining({
        active: false,
        existingProp: existingUsers[0].existingProp,
        id: existingUsers[0].id,
        importDate: previousImportDate,
        sharedProp: existingUsers[0].sharedProp
      })
    }]
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining(expected))
    expect(context.log).toHaveBeenNthCalledWith(1, `Users to import: ${usersToImport.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(2, `Users already existing: ${existingUsers.length}.`)
    expect(context.log).toHaveBeenNthCalledWith(3, 'Running bulk operation for users in batch group 1 to 100.')
    expect(context.log).toHaveBeenNthCalledWith(4, `1 user(s) created: ${usersToImport[0].emailAddress}.`)
    expect(context.log).toHaveBeenNthCalledWith(5, '0 user(s) updated: .')
    expect(context.log).toHaveBeenNthCalledWith(6, `1 user(s) inactive: ${existingUsers[0].id}.`)
  })

  // TODO
  test('users are updated in batches of 100', async () => {
  })

  test('users updated and created share the same import date and report correctly', async () => {
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', importDate: 1234567890 }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp' }, { emailAddress: 'b@b.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(Date.now).toHaveBeenCalledTimes(1)
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining([{
      operationType: 'Upsert',
      partitionKey: usersToImport[1].emailAddress,
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[1].emailAddress,
        importDate,
        newProp: usersToImport[1].newProp,
        sharedProp: usersToImport[1].sharedProp
      })
    }, {
      operationType: 'Upsert',
      partitionKey: usersToImport[0].emailAddress,
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[0].emailAddress,
        importDate,
        newProp: usersToImport[0].newProp
      })
    }]))
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
    expect(binding.connection).toEqual('AzureWebJobsStorage')
  })
})
