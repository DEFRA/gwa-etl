const testEnvVars = require('../test/test-env-vars')
const { generateUsersToImport } = require('../test/generate-users')
const { phoneNumberTypes } = require('../lib/constants')

const inputBindingName = 'blobContents'
const outputBindingName = 'phoneNumbers'
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('ImportData function', () => {
  jest.mock('@azure/cosmos')
  jest.mock('notifications-node-client')

  const context = require('../test/default-context')
  const importDate = Date.now()
  Date.now = jest.fn(() => importDate)

  const orgCodeActive = 'ACTIVE'
  const orgCodeInactive = 'INACTIVE'
  let CosmosClient
  let NotifyClient
  let bulkMock
  let containerMock
  let fetchAllMock
  let importData
  let itemMock
  let queryMock
  let readMock

  function bindUsersForImport (users) {
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(users))
  }

  function expectLoggingToBeCorrect (logs) {
    logs.forEach((log, i) => expect(context.log).toHaveBeenNthCalledWith(i + 1, log))
  }

  function expectEmailCall (content) {
    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalled()
    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledWith(testEnvVars.NOTIFY_TEMPLATE_ID_DATA_IMPORT_REPORT, testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS, { personalisation: { content: expect.stringContaining(content) } })
  }

  function expectEmailToBeSent (content) {
    expectEmailCall(content)
    expect(context.log).toHaveBeenCalledWith(`Sent email to: ${testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS}.`)
  }

  function getExpectedPhoneNumberOutput (phoneNumbers) {
    return `phone number\n${phoneNumbers.map(pn => `${pn.slice(0, 5)} ${pn.slice(5)}`).join('\n')}`
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    NotifyClient = require('notifications-node-client').NotifyClient
    CosmosClient = require('@azure/cosmos').CosmosClient

    readMock = jest.fn()
      .mockResolvedValueOnce({ resource: { data: [{ orgCode: orgCodeActive, active: true }, { orgCode: orgCodeInactive, active: false }] } })
    itemMock = jest.fn(() => { return { read: readMock } })
    bulkMock = jest.fn()
    fetchAllMock = jest.fn()
    queryMock = jest.fn(() => { return { fetchAll: fetchAllMock } })
    containerMock = jest.fn(() => {
      return {
        item: itemMock,
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

  test('Cosmos and Notify clients are correctly created on module import', async () => {
    expect(CosmosClient).toHaveBeenCalledTimes(1)
    expect(CosmosClient).toHaveBeenCalledWith(testEnvVars.COSMOS_DB_CONNECTION_STRING)
    const databaseMock = CosmosClient.mock.instances[0].database
    expect(databaseMock).toHaveBeenCalledTimes(1)
    expect(databaseMock).toHaveBeenCalledWith(testEnvVars.COSMOS_DB_NAME)
    expect(containerMock).toHaveBeenCalledTimes(2)
    expect(containerMock).toHaveBeenNthCalledWith(1, testEnvVars.COSMOS_DB_REFDATA_CONTAINER)
    expect(containerMock).toHaveBeenNthCalledWith(2, testEnvVars.COSMOS_DB_USERS_CONTAINER)
    expect(NotifyClient).toHaveBeenCalledTimes(1)
    expect(NotifyClient).toHaveBeenCalledWith(testEnvVars.NOTIFY_CLIENT_API_KEY)
  })

  test('no users to import results in no db querying and email being sent', async () => {
    const usersToImport = []
    bindUsersForImport(usersToImport)

    await importData(context)

    expect(context.log.warn).toHaveBeenCalledTimes(1)
    expect(context.log.warn).toHaveBeenCalledWith('No users to import, returning early.')
    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledTimes(1)
    expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledWith(testEnvVars.NOTIFY_TEMPLATE_ID_DATA_IMPORT_REPORT, testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS, {
      personalisation: { content: 'There were no users to import.' }
    })
    expect(context.log).toHaveBeenCalledTimes(1)
    expect(context.log).toHaveBeenCalledWith(`Sent email to: ${testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS}.`)
  })

  test('an item to import with an existing record (with a corporate phone number along with a new corporate phone number) is updated (movers or no change)', async () => {
    const existingUsers = [{ id: 'a@a.com', phoneNumbers: [{ number: '07700111111', subscribedTo: ['THIS', 'THAT'], type: phoneNumberTypes.corporate }, { number: '07700333333', type: phoneNumberTypes.personal }], existingProp: 'existingProp', sharedProp: 'existingUser' }]
    const existingPhoneNumbers = existingUsers[0].phoneNumbers
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'A@A.COM', phoneNumbers: ['07700111111', '07700222222'], newProp: 'newProp', sharedProp: 'importUser', orgCode: orgCodeActive }]
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
        phoneNumbers: [
          { number: existingPhoneNumbers[1].number, type: existingPhoneNumbers[1].type },
          { number: existingPhoneNumbers[0].number, subscribedTo: existingPhoneNumbers[0].subscribedTo, type: existingPhoneNumbers[0].type },
          { id: expect.stringMatching(uuidRegex), number: usersToImport[0].phoneNumbers[1], subscribedTo: ['UNK:Unknown'], type: phoneNumberTypes.corporate }
        ],
        sharedProp: usersToImport[0].sharedProp
      })
    }]))
    expect(context.bindings).toHaveProperty(outputBindingName)
    const phoneNumbersOutput = context.bindings[outputBindingName]
    const expectedPhoneNumbers = getExpectedPhoneNumberOutput([existingPhoneNumbers[1].number, existingPhoneNumbers[0].number, usersToImport[0].phoneNumbers[1]])
    expect(phoneNumbersOutput).toHaveLength(expectedPhoneNumbers.length)
    expect(phoneNumbersOutput).toEqual(expectedPhoneNumbers)
    const expectedReport = 'Import was successful.\n1 user was set active.\n0 users were set inactive.'
    expectEmailToBeSent(expectedReport)
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 10.',
      expectedReport
    ])
  })

  test('an item to import with a different corporate phone number than the existing record will remove the existing and add the new number', async () => {
    const existingUsers = [{ id: 'a@a.com', phoneNumbers: [{ number: '07700111111', type: phoneNumberTypes.corporate, subscribedTo: ['THIS', 'THAT'] }, { number: '07700333333', type: phoneNumberTypes.personal }] }]
    const existingPhoneNumbers = existingUsers[0].phoneNumbers
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'A@A.COM', phoneNumbers: ['07777222222'], orgCode: orgCodeActive }]
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
        id: existingUsers[0].id,
        importDate,
        phoneNumbers: [
          { number: existingPhoneNumbers[1].number, type: phoneNumberTypes.personal },
          { id: expect.stringMatching(uuidRegex), number: usersToImport[0].phoneNumbers[0], type: phoneNumberTypes.corporate, subscribedTo: ['UNK:Unknown'] }
        ]
      })
    }]))
    expect(context.bindings).toHaveProperty(outputBindingName)
    const phoneNumbersOutput = context.bindings[outputBindingName]
    const expectedPhoneNumbers = getExpectedPhoneNumberOutput([existingPhoneNumbers[1].number, usersToImport[0].phoneNumbers[0]])
    expect(phoneNumbersOutput).toHaveLength(expectedPhoneNumbers.length)
    expect(phoneNumbersOutput).toEqual(expectedPhoneNumbers)
    const expectedReport = 'Import was successful.\n1 user was set active.\n0 users were set inactive.'
    expectEmailToBeSent(expectedReport)
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 10.',
      expectedReport
    ])
  })

  test('an item to import with the existing record having no phone numbers will add the new number', async () => {
    const existingUsers = [{ id: 'a@a.com', phoneNumbers: [] }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'A@A.COM', phoneNumbers: ['07777222222'], orgCode: orgCodeActive }]
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
        id: existingUsers[0].id,
        importDate,
        phoneNumbers: [
          { id: expect.stringMatching(uuidRegex), number: usersToImport[0].phoneNumbers[0], type: phoneNumberTypes.corporate, subscribedTo: ['UNK:Unknown'] }
        ]
      })
    }]))
    expect(context.bindings).toHaveProperty(outputBindingName)
    const phoneNumbersOutput = context.bindings[outputBindingName]
    const expectedPhoneNumbers = getExpectedPhoneNumberOutput([usersToImport[0].phoneNumbers[0]])
    expect(phoneNumbersOutput).toHaveLength(expectedPhoneNumbers.length)
    expect(phoneNumbersOutput).toEqual(expectedPhoneNumbers)
  })

  test('an item to import with no existing record is created (joiners) with correct schema', async () => {
    const existingUsers = []
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'A@A.COM', newProp: 'newProp', sharedProp: 'importUser', orgCode: orgCodeActive }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress.toLowerCase() }, statusCode: 201 }
    ])

    await importData(context)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith('SELECT * FROM c')
    expect(bulkMock).toHaveBeenCalledTimes(1)
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining([{
      operationType: 'Upsert',
      partitionKey: usersToImport[0].emailAddress.toLowerCase(),
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[0].emailAddress.toLowerCase(),
        importDate,
        newProp: usersToImport[0].newProp,
        phoneNumbers: [],
        sharedProp: usersToImport[0].sharedProp
      })
    }]))
    expect(context.bindings).toHaveProperty(outputBindingName)
    const phoneNumbersOutput = context.bindings[outputBindingName]
    const expectedPhoneNumbers = getExpectedPhoneNumberOutput([])
    expect(phoneNumbersOutput).toHaveLength(expectedPhoneNumbers.length)
    expect(phoneNumbersOutput).toEqual(expectedPhoneNumbers)
    const expectedReport = 'Import was successful.\n1 user was set active.\n0 users were set inactive.'
    expectEmailToBeSent(expectedReport)
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 1\nUsers still to be updated: 0\nCost (RUs): 10.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 10.',
      expectedReport
    ])
  })

  test('an existing record with no item to import is set inactive (leavers)', async () => {
    const previousImportDate = 12345567890
    const existingUsers = [{ id: 'a@a.com', existingProp: 'existingProp', sharedProp: 'existingUser', importDate: previousImportDate, orgCode: orgCodeActive }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'B@B.COM', newProp: 'newProp', sharedProp: 'importUser', orgCode: orgCodeActive }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: existingUsers[0].id }, statusCode: 200 },
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress.toLowerCase() }, statusCode: 200 }
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
    expect(context.bindings).toHaveProperty(outputBindingName)
    const phoneNumbersOutput = context.bindings[outputBindingName]
    const expectedPhoneNumbers = getExpectedPhoneNumberOutput([])
    expect(phoneNumbersOutput).toHaveLength(expectedPhoneNumbers.length)
    expect(phoneNumbersOutput).toEqual(expectedPhoneNumbers)
    const expectedReport = 'Import was successful.\n1 user was set active.\n1 user was set inactive.'
    expectEmailToBeSent(expectedReport)
    expectLoggingToBeCorrect([
      `Users to import: ${usersToImport.length}.`,
      `Users already existing: ${existingUsers.length}.`,
      'Running bulk operation for users in batch group 1 to 100.',
      `Processing next batch in ${testEnvVars.IMPORT_BULK_BATCH_SLEEP_DURATION} milliseconds.`,
      'Users updated successfully: 2\nUsers still to be updated: 0\nCost (RUs): 20.',
      'After 1 attempt(s), 0 user(s) are still to be updated.',
      'Total cost (RUs): 20.',
      expectedReport
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
    const existingUsers = [{ id: 'a@a.com', phoneNumbers: [], existingProp: 'existingProp', importDate: 1234567890, orgCode: orgCodeActive }]
    fetchAllMock.mockResolvedValueOnce({ resources: existingUsers })
    const usersToImport = [{ emailAddress: 'a@a.com', phoneNumbers: [], newProp: 'newProp' }, { emailAddress: 'b@b.com', phoneNumbers: [], newProp: 'newProp', sharedProp: 'importUser', orgCode: orgCodeActive }]
    bindUsersForImport(usersToImport)
    bulkMock.mockResolvedValueOnce([
      { requestCharge: 10, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 200 },
      { requestCharge: 10, resourceBody: { id: usersToImport[1].emailAddress }, statusCode: 200 }
    ])

    await importData(context)

    expect(Date.now).toHaveBeenCalledTimes(1)
    expect(bulkMock).toHaveBeenCalledWith(expect.arrayContaining([{
      operationType: 'Upsert',
      partitionKey: usersToImport[0].emailAddress,
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[0].emailAddress,
        importDate,
        newProp: usersToImport[0].newProp
      })
    }, {
      operationType: 'Upsert',
      partitionKey: usersToImport[1].emailAddress,
      resourceBody: expect.objectContaining({
        active: true,
        id: usersToImport[1].emailAddress,
        importDate,
        newProp: usersToImport[1].newProp,
        sharedProp: usersToImport[1].sharedProp
      })
    }]))
  })

  test('an error is logged when an update response contains an unhandled statusCode', async () => {
    const usersToImport = [{ emailAddress: 'a@a.com', orgCode: orgCodeActive }]
    const unhandldedResponse = { requestCharge: 0, resourceBody: { id: usersToImport[0].emailAddress }, statusCode: 409 }
    fetchAllMock.mockResolvedValueOnce({ resources: [] })
    bindUsersForImport(usersToImport)
    bulkMock
      .mockResolvedValueOnce([unhandldedResponse])
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

  test('an error is logged when there is no org list ref data', async () => {
    const usersToImport = [{ emailAddress: 'a@a.com' }]
    bindUsersForImport(usersToImport)
    fetchAllMock.mockResolvedValueOnce({ resources: [] })
    readMock = jest.fn().mockResolvedValueOnce(null)

    await expect(importData(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
    expectEmailToBeSent('Import failed.\nError message: No reference data retrieved for organisationList.')
  })

  test('an error during email sending is thrown (and logged)', async () => {
    bindUsersForImport([])
    NotifyClient.prototype.sendEmail.mockRejectedValue(new Error())

    await expect(importData(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
    expectEmailCall('There were no users to import')
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(importData(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
    expectEmailToBeSent('Import failed.\nError message: Cannot destructure property \'blobContents\'')
  })
})

describe('ImportData bindings', () => {
  const { bindings: functionBindings } = require('./function')

  const { validUsersFilename } = require('../lib/config')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')

    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${validUsersFilename}`)
    expect(binding.connection).toEqual('AzureWebJobsStorage')
  })

  test('output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('blob')
    expect(binding.path).toEqual(`%${testEnvVars.PHONE_NUMBERS_CONTAINER}%/%${testEnvVars.PHONE_NUMBERS_FILE}%`)
  })
})
