const { zipFilename } = require('../lib/config')
const testEnvVars = require('../test/test-env-vars')

const inputBindingName = 'blobContents'

describe('EmailPhoneNumbers function', () => {
  jest.mock('@azure/storage-blob')
  jest.mock('notifications-node-client')
  jest.mock('archiver')
  jest.mock('archiver-zip-encrypted')

  const context = require('../test/default-context')

  const userData = [{ emailAddress: 'a@a.com' }]
  const triggerFileContents = Buffer.from(JSON.stringify(userData))

  let BlockBlobClient
  let NotifyClient
  let archiver
  let archiverZipEncrypt
  let emailPhoneNumbers

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    emailPhoneNumbers = require('.')
    BlockBlobClient = require('@azure/storage-blob').BlockBlobClient
    NotifyClient = require('notifications-node-client').NotifyClient
    archiver = require('archiver')
    archiverZipEncrypt = require('archiver-zip-encrypted')

    context.bindings[inputBindingName] = triggerFileContents
  })

  test('clients are created when module is imported, with correct env vars', async () => {
    expect(BlockBlobClient).toHaveBeenCalledTimes(1)
    expect(BlockBlobClient).toHaveBeenCalledWith(testEnvVars.AzureWebJobsStorage, testEnvVars.PHONE_NUMBERS_CONTAINER, zipFilename)
    expect(NotifyClient).toHaveBeenCalledTimes(1)
    expect(NotifyClient).toHaveBeenCalledWith(testEnvVars.NOTIFY_CLIENT_API_KEY)
    expect(archiver.registerFormat).toHaveBeenCalledTimes(1)
    expect(archiver.registerFormat).toHaveBeenCalledWith('zip-encrypted', archiverZipEncrypt)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('EmailPhoneNumbers bindings', () => {
  const { bindings: functionBindings } = require('./function')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.PHONE_NUMBERS_CONTAINER}%/%${testEnvVars.PHONE_NUMBERS_FILE}%`)
  })
})
