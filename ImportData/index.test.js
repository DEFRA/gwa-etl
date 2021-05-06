const testEnvVars = require('../test/testEnvVars')
const { generateUsersToImport } = require('../test/generateUsers')

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
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: existingUsers[0].id }, statusCode: 200 }
    ])

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
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 10.',
      '0 user(s) created: .',
      `1 user(s) updated: ${existingUsers[0].id}.`,
      '0 user(s) inactive: .'
    ])
  })

  test('an item to import with no existing record is created (joiners)', async () => {
    const existingUsers = []
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 200 }
    ])

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
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 10.',
      `1 user(s) created: ${usersToImport[0].emailAddress}.`,
      '0 user(s) updated: .',
      '0 user(s) inactive: .'
    ])
  })

  function expectLoggingToBeCorrect (logs) {
    logs.forEach((log, i) => expect(context.log).toHaveBeenNthCalledWith(i + 1, log))
  }

  test('an existing record with no item to import is set inactive (leavers)', async () => {
    const previousImportDate = 12345567890
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser', importDate: previousImportDate }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'b@b.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: existingUsers[0].id }, statusCode: 200 },
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 200 }
    ])

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
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 2\nUsers still to be updated: 0\nCost (RUs): 20.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 20.',
      `1 user(s) created: ${usersToImport[0].emailAddress}.`,
      '0 user(s) updated: .',
      `1 user(s) inactive: ${existingUsers[0].id}.`
    ])
  })

  test('users are updated in batches of 100', async () => {
    const usersToImport = generateUsersToImport(101)
    fetchAllMock.mockResolvedValueOnce({ resources: [] })
    bindUsersForImport(usersToImport)
    bulkMock
      .mockResolvedValueOnce(
        usersToImport.slice(0, 100).map(user => {
          return { requestCharge: 10, resourceBody: { id: user.emailAddress }, statusCode: 200 }
        })
      )
      .mockResolvedValueOnce(
        usersToImport.slice(100).map(user => {
          return { requestCharge: 10, resourceBody: { id: user.emailAddress }, statusCode: 200 }
        })
      )

    await importData(context)

    expect(bulkMock).toHaveBeenCalledTimes(2)
    expect(bulkMock.mock.calls[0][0]).toHaveLength(100)
    expect(bulkMock.mock.calls[1][0]).toHaveLength(1)
    expect(context.log).toHaveBeenNthCalledWith(3, 'Running bulk operation for users in batch group 1 to 100.')
    expect(context.log).toHaveBeenNthCalledWith(5, 'Running bulk operation for users in batch group 101 to 200.')
  })

  test('rate limited updates are retried 10 times', async () => {
    const tooManyRequestsResponse = { requestCharge: 0, retryAfterMilliseconds: 5, statusCode: 429 }
    const usersToImport = [{ emailAddress: 'a@a.com' }, { emailAddress: 'b@b.com' }]
    fetchAllMock.mockResolvedValueOnce({ resources: [] })
    bindUsersForImport(usersToImport)
    bulkMock
      .mockResolvedValueOnce([{ requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 200 }, tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([tooManyRequestsResponse])
      .mockResolvedValueOnce([{ requestCharge: 10, resourceBody: { id: usersToImport[1].emailAddress }, statusCode: 200 }])

    await importData(context)

    expect(bulkMock).toHaveBeenCalledTimes(10)
    expect(bulkMock.mock.calls[0][0]).toHaveLength(2)
    expect(bulkMock.mock.calls[1][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[2][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[3][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[4][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[5][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[6][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[7][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[8][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[9][0]).toHaveLength(1)

    expect(context.log.mock.calls[2][0]).toEqual('Running bulk operation for users in batch group 1 to 100.')
    expect(context.log.mock.calls[3][0]).toEqual(`Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`)
    expect(context.log.mock.calls[4][0]).toEqual('Users updated successfully: 1\nUsers still to be updated: 1\nCost (RUs): 10.')
    for (let i = 0; i < 8; i++) {
      expect(context.log.mock.calls[i * 4 + 5][0]).toEqual(`Making attempt ${i + 2} in ${testEnvVars.IMPORT_ATTEMPT_SLEEP_DURATION} milliseconds.`)
      expect(context.log.mock.calls[i * 4 + 6][0]).toEqual('Running bulk operation for users in batch group 1 to 100.')
      expect(context.log.mock.calls[i * 4 + 7][0]).toEqual(`Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`)
      expect(context.log.mock.calls[i * 4 + 8][0]).toEqual('Users updated successfully: 0\nUsers still to be updated: 1\nCost (RUs): 0.')
    }
    expect(context.log.mock.calls[40][0]).toEqual('Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.')
    expect(context.log.mock.calls[41][0]).toEqual('After 10 attempt(s), 0 user(s) are still to be updated.')
    expect(context.log.mock.calls[42][0]).toEqual('Total cost (RUs): 20.')

    expect(context.log.warn).toHaveBeenCalledTimes(9)
    expect(context.log.warn).toHaveBeenCalledWith(tooManyRequestsResponse)
  })

  test('users updated and created share the same import date and report correctly', async () => {
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', importDate: 1234567890 }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', newProp: 'newProp' }, { emailAddress: 'b@b.com', newProp: 'newProp', sharedProp: 'importUser' }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 200 },
      { requestCharge: 10, resourceBody: { id: usersToImport[1].emailAddress }, statusCode: 200 }
    ])

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

  test('an error is logged when an update response contains an handled statusCode', async () => {
    const usersToImport = [{ emailAddress: 'a@a.com' }]
    const unhandldedResponse = { requestCharge: 0, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 409 }
    fetchAllMock.mockResolvedValueOnce({ resources: [] })
    bindUsersForImport(usersToImport)
    bulkMock
      .mockResolvedValueOnce(
        usersToImport.map(user => { return unhandldedResponse })
      )
      .mockResolvedValueOnce(
        usersToImport.map(user => { return { requestCharge: 10, resourceBody: { id: user.emailAddress }, statusCode: 200 } })
      )

    await importData(context)

    expect(bulkMock).toHaveBeenCalledTimes(2)
    expect(bulkMock.mock.calls[0][0]).toHaveLength(1)
    expect(bulkMock.mock.calls[1][0]).toHaveLength(1)
    expect(context.log.error).toHaveBeenCalledTimes(1)
    expect(context.log.error).toHaveBeenCalledWith(unhandldedResponse)
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
