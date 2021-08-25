const path = require('path')
const { zipFilename } = require('../lib/config')
const testEnvVars = require('../test/test-env-vars')
const { exists, removeFile } = require('../test/utils')

const inputBindingName = 'blobContents'

describe('EmailPhoneNumbers function', () => {
  jest.mock('@azure/storage-blob')
  jest.mock('notifications-node-client')

  const context = require('../test/default-context')

  const userData = [{ emailAddress: 'a@a.com' }]
  const triggerFileContents = Buffer.from(JSON.stringify(userData))
  const zipPath = path.join(process.env.HOME, zipFilename)

  let BlobSASPermissions
  let BlockBlobClient
  let NotifyClient
  let emailPhoneNumbers
  const now = Date.now()
  const date = new Date(now)
  Date.now = jest.fn(() => now)

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    emailPhoneNumbers = require('.')
    BlobSASPermissions = require('@azure/storage-blob').BlobSASPermissions
    BlockBlobClient = require('@azure/storage-blob').BlockBlobClient
    NotifyClient = require('notifications-node-client').NotifyClient

    context.bindings[inputBindingName] = triggerFileContents

    await removeFile(zipPath)
    expect(await exists(zipPath)).toEqual(false)
  })

  describe('happy path', () => {
    test('clients are created when module is imported, with correct env vars', async () => {
      expect(BlockBlobClient).toHaveBeenCalledTimes(1)
      expect(BlockBlobClient).toHaveBeenCalledWith(testEnvVars.AzureWebJobsStorage, testEnvVars.PHONE_NUMBERS_CONTAINER, zipFilename)
      expect(NotifyClient).toHaveBeenCalledTimes(1)
      expect(NotifyClient).toHaveBeenCalledWith(testEnvVars.NOTIFY_CLIENT_API_KEY)
    })

    test('zip file is uploaded and email is sent with correct content', async () => {
      const permissionsMock = 'r'
      BlobSASPermissions.parse.mockImplementation(() => permissionsMock)
      date.setDate(date.getDate() + 29)
      const sasUrl = 'mockSasUrl'
      BlockBlobClient.prototype.generateSasUrl.mockResolvedValue(sasUrl)

      await emailPhoneNumbers(context)

      expect(await exists(zipPath)).toEqual(true)

      const uploadFileMock = BlockBlobClient.mock.instances[0].uploadFile
      expect(uploadFileMock).toHaveBeenCalled()
      expect(uploadFileMock).toHaveBeenCalledWith(zipPath, { blobHTTPHeaders: { blobContentType: 'application/zip' } })
      const generateSasUrlMock = BlockBlobClient.mock.instances[0].generateSasUrl
      expect(generateSasUrlMock).toHaveBeenCalled()
      expect(generateSasUrlMock).toHaveBeenCalledWith({ expiresOn: date, permissions: permissionsMock })
      expect(NotifyClient.prototype.sendEmail).toHaveBeenCalled()
      expect(NotifyClient.prototype.sendEmail).toHaveBeenCalledWith(testEnvVars.NOTIFY_TEMPLATE_ID_EMERGENCY_CONTACT_LIST, testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS, { personalisation: { linkToFile: sasUrl } })
      expect(context.log).toHaveBeenCalledTimes(3)
      expect(context.log).toHaveBeenNthCalledWith(1, `Uploaded file: ${zipFilename} to container: ${testEnvVars.PHONE_NUMBERS_CONTAINER}.`)
      expect(context.log).toHaveBeenNthCalledWith(2, `Generated sasUrl: ${sasUrl}.`)
      expect(context.log).toHaveBeenNthCalledWith(3, `Sent email to: ${testEnvVars.NOTIFY_SEND_TO_EMAIL_ADDRESS}.`)
    })
  })

  describe('errors', () => {
    test('an error is thrown (and logged) when an error occurs during zip creation', async () => {
      const password = process.env.PHONE_NUMBERS_ZIP_PASSWORD
      process.env.PHONE_NUMBERS_ZIP_PASSWORD = ''
      jest.resetModules()
      emailPhoneNumbers = require('.')

      await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

      expect(context.log.error).toHaveBeenCalledTimes(1)
      expect(context.log.error).toHaveBeenCalledWith(new Error('options.password is required'))
      process.env.PHONE_NUMBERS_ZIP_PASSWORD = password
    })

    test('an error is thrown (and logged) when an error occurs during file upload', async () => {
      const error = new Error('file upload')
      BlockBlobClient.prototype.uploadFile.mockRejectedValue(error)

      await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

      expect(context.log.error).toHaveBeenCalledTimes(1)
      expect(context.log.error).toHaveBeenCalledWith(error)
    })

    test('an error is thrown (and logged) when an error occurs during sasUrl generation', async () => {
      const error = new Error('sasUrl generation')
      BlockBlobClient.prototype.generateSasUrl.mockRejectedValue(error)

      await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

      expect(context.log.error).toHaveBeenCalledTimes(1)
      expect(context.log.error).toHaveBeenCalledWith(error)
    })

    test('an error is thrown (and logged) when an error occurs during email sending', async () => {
      const error = new Error('email sending')
      NotifyClient.prototype.sendEmail.mockRejectedValue(error)

      await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

      expect(context.log.error).toHaveBeenCalledTimes(1)
      expect(context.log.error).toHaveBeenCalledWith(error)
    })

    test('an error is thrown (and logged) when an error occurs', async () => {
      // Doesn't matter what causes the error, just that an error is thrown
      context.bindings = null

      await expect(emailPhoneNumbers(context)).rejects.toThrow(Error)

      expect(context.log.error).toHaveBeenCalledTimes(1)
    })
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
