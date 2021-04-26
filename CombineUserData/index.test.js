const { ContainerClient } = require('@azure/storage-blob')

jest.mock('@azure/storage-blob')

const combineUserData = require('.')
const { bindings: functionBindings } = require('./function')

const context = require('../test/defaultContext')
const testEnvVars = require('../test/testEnvVars')

const triggerFilename = 'triggerFilename'
const inputBindingName = 'myBlob'
const inputBlobBindingName = 'triggerFileContents'

describe('CombineUserData function', () => {
  beforeAll(() => {
    context.bindingData[triggerFilename] = ''
    context.bindings[inputBlobBindingName] = 'inputBlobBindingName'
  })

  afterEach(() => { jest.clearAllMocks() })

  test('clients are created with correct env vars', async () => {
    await combineUserData(context)

    expect(ContainerClient).toHaveBeenCalledTimes(1)
    expect(ContainerClient).toHaveBeenCalledWith(testEnvVars.AzureWebJobsStorage, testEnvVars.DATA_EXTRACT_CONTAINER)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(combineUserData(context)).rejects.toThrow(Error)
    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('CombineUserData bindings', () => {
  const inputBindings = functionBindings.filter((binding) => binding.direction === 'in')

  test('two input bindings exist', () => {
    expect(inputBindings).toHaveLength(2)
  })

  test('input bindings', () => {
    expect(inputBindings).toHaveLength(2)

    const binding = inputBindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.type).toEqual('blobTrigger')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_EXTRACT_CONTAINER}%/{${triggerFilename}}`)
  })
  test('blobTrigger input binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blobTrigger')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_EXTRACT_CONTAINER}%/{triggerFilename}`)
  })

  test('blob binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blob')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_EXTRACT_CONTAINER}%/{triggerFilename}`)
  })
})
