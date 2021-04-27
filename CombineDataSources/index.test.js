const { allUsersFilename, internalUsersFilename } = require('../lib/config')

const combineDataSources = require('.')
const { bindings: functionBindings } = require('./function')

const context = require('../test/defaultContext')
const testEnvVars = require('../test/testEnvVars')

const inputBindingName = 'myBlob'
const inputBlobBindingName = 'internalUsersFileContents'
const outputBindingName = 'users'

describe('CombineDataSources function', () => {
  test('incoming file contents are saved to output binding', async () => {
    const inputFileContents = 'some file contents'
    context.bindings[inputBlobBindingName] = inputFileContents

    await combineDataSources(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toEqual(inputFileContents)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(combineDataSources(context)).rejects.toThrow(Error)
    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('CombineDataSources bindings', () => {
  const inputBindings = functionBindings.filter((binding) => binding.direction === 'in')

  test('two input bindings exist', () => {
    expect(inputBindings).toHaveLength(2)
  })

  test('blobTrigger input binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blobTrigger')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_SOURCES_CONTAINER}%/${internalUsersFilename}`)
  })

  test('blob binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blob')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_SOURCES_CONTAINER}%/${internalUsersFilename}`)
  })

  test('output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('blob')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${allUsersFilename}`)
  })
})
