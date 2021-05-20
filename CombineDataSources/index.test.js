const { v4: uuid } = require('uuid')

const inputBlobBindingName = 'blobContents'
const errorUsersOutputBindingName = 'errorUsers'
const validUsersOutputBindingName = 'validUsers'

describe('CombineDataSources function', () => {
  const combineDataSources = require('.')
  const context = require('../test/defaultContext')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('users are saved to valid users output binding when they are valid input', async () => {
    const inputFileContents = [{
      id: uuid(),
      companyName: 'companyName',
      officeLocation: 'officeLocation',
      surname: 'surname',
      givenName: 'givenName',
      phoneNumbers: ['07000111222'],
      emailAddress: 'a@a.com'
    }]
    context.bindings[inputBlobBindingName] = Buffer.from(JSON.stringify(inputFileContents))

    await combineDataSources(context)

    expect(context.bindings).toHaveProperty(validUsersOutputBindingName)
    expect(context.bindings[validUsersOutputBindingName]).toEqual(inputFileContents)
    expect(context.bindings).toHaveProperty(errorUsersOutputBindingName)
    expect(context.bindings[errorUsersOutputBindingName]).toHaveLength(0)
  })

  test('users are saved to error users output binding when they are not valid input', async () => {
    const inputFileContents = [{ emailAddress: 'a@a.com' }]
    context.bindings[inputBlobBindingName] = Buffer.from(JSON.stringify(inputFileContents))

    await combineDataSources(context)

    expect(context.bindings).toHaveProperty(errorUsersOutputBindingName)
    expect(context.bindings[errorUsersOutputBindingName]).toHaveLength(1)
    expect(context.bindings).toHaveProperty(validUsersOutputBindingName)
    expect(context.bindings[validUsersOutputBindingName]).toHaveLength(0)
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
  const { errorUsersFilename, internalUsersFilename, validUsersFilename } = require('../lib/config')
  const testEnvVars = require('../test/testEnvVars')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_SOURCES_CONTAINER}%/${internalUsersFilename}`)
  })

  test('output bindings are correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(2)

    const validUsersBinding = bindings[0]
    expect(validUsersBinding.name).toEqual(validUsersOutputBindingName)
    expect(validUsersBinding.type).toEqual('blob')
    expect(validUsersBinding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${validUsersFilename}`)

    const errorUsersBinding = bindings[1]
    expect(errorUsersBinding.name).toEqual(errorUsersOutputBindingName)
    expect(errorUsersBinding.type).toEqual('blob')
    expect(errorUsersBinding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${errorUsersFilename}`)
  })
})
