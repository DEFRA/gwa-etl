const { ContainerClient } = require('@azure/storage-blob')
const getBlobContents = require('../lib/getBlobContents')
const combineData = require('../lib/combineData')

jest.mock('@azure/storage-blob')
jest.mock('../lib/getBlobContents')
jest.mock('../lib/combineData')

const { aadFilename, awFilename } = require('../lib/config')

const combineUserData = require('.')
const { bindings: functionBindings } = require('./function')

const context = require('../test/defaultContext')
const testEnvVars = require('../test/testEnvVars')

const triggerFilename = 'triggerFilename'
const inputBindingName = 'myBlob'
const inputBlobBindingName = 'triggerFileContents'
const triggerFileContents = []
const outputBindingName = 'internalUsers'

describe('CombineUserData function', () => {
  beforeAll(() => {
    context.bindingData[triggerFilename] = ''
    context.bindings[inputBlobBindingName] = triggerFileContents
    getBlobContents.mockClear()
  })

  beforeEach(() => {
    context.log.warn.mockClear()
  })

  test('clients are created when module is imported, with correct env vars', async () => {
    expect(ContainerClient).toHaveBeenCalledTimes(1)
    expect(ContainerClient).toHaveBeenCalledWith(testEnvVars.AzureWebJobsStorage, testEnvVars.DATA_EXTRACT_CONTAINER)
  })

  test('triggering for aw file will retreive aad file', async () => {
    getBlobContents.mockImplementation(() => { return null })
    context.bindingData[triggerFilename] = awFilename

    await combineUserData(context)

    expect(getBlobContents).toHaveBeenCalledTimes(1)
    expect(getBlobContents).toHaveBeenCalledWith(ContainerClient.mock.instances[0], aadFilename)
  })

  test('triggering for aad file will retreive aw file', async () => {
    getBlobContents.mockImplementation(() => { return null })
    context.bindingData[triggerFilename] = aadFilename

    await combineUserData(context)

    // TODO: number of calls should be 1 not 2!
    expect(getBlobContents).toHaveBeenCalledTimes(2)
    expect(getBlobContents).toHaveBeenCalledWith(ContainerClient.mock.instances[0], awFilename)
  })

  test('the combining of data is attached to output binding', async () => {
    const combinedData = []
    const retrievedFileContents = []
    combineData.mockImplementation(() => { return combinedData })
    getBlobContents.mockImplementation(() => { return retrievedFileContents })
    context.bindingData[triggerFilename] = aadFilename

    await combineUserData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toEqual(combinedData)
    expect(combineData).toHaveBeenCalledTimes(1)
    expect(combineData).toHaveBeenCalledWith(triggerFileContents, retrievedFileContents)
  })

  test('a file returning no data logs a warning', async () => {
    getBlobContents.mockImplementation(() => { return null })
    context.bindingData[triggerFilename] = aadFilename

    await combineUserData(context)

    expect(context.log.warn).toHaveBeenCalledTimes(1)
    expect(context.log.warn).toHaveBeenCalledWith(`'${awFilename}' not found, no data will be combined.`)
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

  test('output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('blob')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_SOURCES_CONTAINER}%/internal-users.json`)
  })
})