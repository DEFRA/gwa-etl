const { v4: uuid } = require('uuid')

const inputBlobBindingName = 'blobContents'
const errorUsersOutputBindingName = 'errorUsers'
const validUsersOutputBindingName = 'validUsers'

describe('CombineDataSources function', () => {
  const combineDataSources = require('.')
  const context = require('../test/defaultContext')
  const validInput = {
    id: uuid(),
    emailAddress: 'a@a.com',
    orgCode: 'ORGCODE',
    orgName: 'A well formatted name',
    officeCode: 'VLD:validOfficeLocation-1-99',
    officeLocation: 'a valid office location',
    givenName: 'givenName',
    surname: 'surname',
    phoneNumbers: ['07000111222']
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('users are saved to valid users output binding when they are valid input', async () => {
    const inputFileContents = [validInput]
    context.bindings[inputBlobBindingName] = Buffer.from(JSON.stringify(inputFileContents))

    await combineDataSources(context)

    expect(context.bindings).toHaveProperty(validUsersOutputBindingName)
    expect(context.bindings[validUsersOutputBindingName]).toEqual(inputFileContents)
    expect(context.bindings).toHaveProperty(errorUsersOutputBindingName)
    expect(context.bindings[errorUsersOutputBindingName]).toHaveLength(0)
  })

  test.each([
    ['id'],
    ['emailAddress'],
    ['officeCode'],
    ['officeLocation'],
    ['orgCode'],
    ['orgName'],
    ['givenName'],
    ['surname'],
    ['phoneNumbers']
  ])('users are saved to error users output binding when they are not valid input - missing property (%s)', async (property) => {
    const input = { ...validInput }
    delete input[property]
    const inputFileContents = [input]
    context.bindings[inputBlobBindingName] = Buffer.from(JSON.stringify(inputFileContents))

    await combineDataSources(context)

    expect(context.bindings).toHaveProperty(errorUsersOutputBindingName)
    expect(context.bindings[errorUsersOutputBindingName]).toHaveLength(1)
    expect(context.bindings).toHaveProperty(validUsersOutputBindingName)
    expect(context.bindings[validUsersOutputBindingName]).toHaveLength(0)
  })

  test.each([
    ['id', undefined],
    ['id', 'not-a-guid'],
    ['emailAddress', undefined],
    ['emailAddress', 'not-an-email'],
    ['officeCode', undefined],
    ['officeCode', 'WRONG:format'],
    ['officeLocation', undefined],
    ['orgCode', undefined],
    ['orgName', undefined],
    ['givenName', undefined],
    ['surname', undefined],
    ['phoneNumbers', undefined]
  ])('users are saved to error users output binding when they are not valid input - incorrect format property (%s)', async (property, value) => {
    const input = { ...validInput }
    input[property] = value
    const inputFileContents = [input]
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
