const inputBlobBindingName = 'blobContents'
const duplicateUsersOutputBindingName = 'duplicateUsers'
const errorUsersOutputBindingName = 'errorUsers'
const validUsersOutputBindingName = 'validUsers'
const testEnvVars = require('../test/test-env-vars')

describe('CombineDataSources function', () => {
  const context = require('../test/default-context')

  let combineDataSources
  let ContainerClient
  let getContainerContents
  let validateUsers

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    ContainerClient = require('@azure/storage-blob').ContainerClient
    jest.mock('@azure/storage-blob')
    jest.mock('../lib/get-container-contents')
    getContainerContents = require('../lib/get-container-contents')
    jest.mock('../lib/validate-users')
    validateUsers = require('../lib/validate-users')

    combineDataSources = require('.')
    context.bindingData = { blobTrigger: 'blobTrigger', userDataBlobName: 'userDataBlobName.json' }
    context.bindings = { blobContents: [] }
  })

  test('Cosmos client is correctly created on module import', async () => {
    expect(ContainerClient).toHaveBeenCalledTimes(1)
    expect(ContainerClient).toHaveBeenCalledWith(testEnvVars.AzureWebJobsStorage, testEnvVars.DATA_SOURCES_CONTAINER)
  })

  test('no data in internal users file and no other blobs', async () => {
    getContainerContents.mockResolvedValue([undefined])
    validateUsers.mockReturnValue({ errorUsers: [], validUsers: [] })

    await combineDataSources(context)

    const { bindings } = context
    expect(bindings).toHaveProperty(duplicateUsersOutputBindingName)
    expect(bindings.duplicateUsers).toEqual([])
    expect(bindings).toHaveProperty(errorUsersOutputBindingName)
    expect(bindings.errorUsers).toEqual([])
    expect(bindings).toHaveProperty(validUsersOutputBindingName)
    expect(bindings.validUsers).toEqual([])
  })

  test('valid and error users are bound correctly - internal users only', async () => {
    const validUsers = [{ emailAddress: 'abc@test.com' }]
    const errorUsers = [{ emailAddress: 'xyz@test.com' }]
    const internalUsers = [validUsers, errorUsers].flat()
    getContainerContents.mockResolvedValue([internalUsers])
    validateUsers.mockReturnValue({ errorUsers, validUsers })

    await combineDataSources(context)

    const { bindings } = context
    expect(bindings.duplicateUsers).toEqual([])
    expect(bindings.errorUsers).toEqual(errorUsers)
    expect(bindings.validUsers).toEqual(validUsers)
  })

  test('valid and error users are bound correctly - internal and non internal users', async () => {
    const errorUsers = [{ emailAddress: 'xyz@test.com' }]
    const internalUsers = [{ emailAddress: 'abc@test.com' }, errorUsers].flat()
    const nonInternalUsersOne = [{ emailAddress: '123@test.com' }]
    const nonInternalUsersTwo = [{ emailAddress: '456@test.com' }, { emailAddress: '789@test.com' }]
    getContainerContents.mockResolvedValue([internalUsers, nonInternalUsersOne, nonInternalUsersTwo])
    const validUsers = [internalUsers[0], nonInternalUsersOne, nonInternalUsersTwo].flat()
    validateUsers.mockReturnValue({ errorUsers, validUsers })

    await combineDataSources(context)

    const { bindings } = context
    expect(bindings.duplicateUsers).toEqual([])
    expect(bindings.errorUsers).toEqual(errorUsers)
    expect(bindings.validUsers).toEqual(validUsers)
    expect(context.log).toHaveBeenCalledTimes(2)
    expect(context.log).toHaveBeenNthCalledWith(1, 'Combine Data Sources Blob Trigger function activated:\n - Blob: blobTrigger\n - Name: userDataBlobName.json\n - Size: 0 Bytes')
    expect(context.log).toHaveBeenNthCalledWith(2, `Valid user count: ${validUsers.length}\nError user count: ${errorUsers.length}\nDuplicate user count: ${[].length}`)
  })

  test('users duplicated across internal and non-internal sources are kept and added to the duplicateUsers binding', async () => {
    const validUsers = [{ emailAddress: 'abc@test.com' }]
    const errorUsers = []
    const internalUsers = [validUsers, errorUsers].flat()
    const nonInternalUsers = validUsers
    getContainerContents.mockResolvedValue([internalUsers, nonInternalUsers])
    validateUsers.mockReturnValue({ errorUsers, validUsers })

    await combineDataSources(context)

    const { bindings } = context
    expect(bindings.duplicateUsers).toEqual(validUsers)
    expect(bindings.errorUsers).toEqual(errorUsers)
    expect(bindings.validUsers).toEqual(validUsers)
  })

  test('users duplicated across non-internal sources are removed and added to duplicateUsers binding', async () => {
    const validUsers = [{ emailAddress: 'abc@test.com' }]
    const errorUsers = []
    const internalUsers = [validUsers, errorUsers].flat()
    const nonInternalUsersOne = [{ emailAddress: 'xyz@test.com' }]
    const nonInternalUsersTwo = nonInternalUsersOne
    getContainerContents.mockResolvedValue([internalUsers, nonInternalUsersOne, nonInternalUsersTwo])
    validateUsers.mockReturnValue({ errorUsers, validUsers })

    await combineDataSources(context)

    const { bindings } = context
    expect(bindings.duplicateUsers).toEqual(nonInternalUsersOne)
    expect(bindings.errorUsers).toEqual(errorUsers)
    expect(bindings.validUsers).toEqual(validUsers)
    expect(context.log).toHaveBeenNthCalledWith(2, `Valid user count: ${validUsers.length}\nError user count: ${errorUsers.length}\nDuplicate user count: ${nonInternalUsersOne.length}`)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(combineDataSources(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('CombineDataSources bindings', () => {
  const { bindings: functionBindings } = require('./function')
  const { errorUsersFilename, duplicateUsersFilename, validUsersFilename } = require('../lib/config')
  const testEnvVars = require('../test/test-env-vars')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_SOURCES_CONTAINER}%/{userDataBlobName}`)
  })

  test('output bindings are correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(3)

    const validUsersBinding = bindings[0]
    expect(validUsersBinding.name).toEqual(validUsersOutputBindingName)
    expect(validUsersBinding.type).toEqual('blob')
    expect(validUsersBinding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${validUsersFilename}`)

    const errorUsersBinding = bindings[1]
    expect(errorUsersBinding.name).toEqual(errorUsersOutputBindingName)
    expect(errorUsersBinding.type).toEqual('blob')
    expect(errorUsersBinding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${errorUsersFilename}`)

    const duplicateUsersBinding = bindings[2]
    expect(duplicateUsersBinding.name).toEqual(duplicateUsersOutputBindingName)
    expect(duplicateUsersBinding.type).toEqual('blob')
    expect(duplicateUsersBinding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${duplicateUsersFilename}`)
  })
})
