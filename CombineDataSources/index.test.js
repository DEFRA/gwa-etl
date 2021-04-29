const inputBlobBindingName = 'blobContents'
const outputBindingName = 'users'

describe('CombineDataSources function', () => {
  const combineDataSources = require('.')
  const context = require('../test/defaultContext')

  test('incoming file contents are saved to output binding', async () => {
    const inputFileContents = [{ emailAddress: 'a@a.com' }]
    context.bindings[inputBlobBindingName] = Buffer.from(JSON.stringify(inputFileContents))

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
  const { bindings: functionBindings } = require('./function')
  const { allUsersFilename, internalUsersFilename } = require('../lib/config')
  const testEnvVars = require('../test/testEnvVars')

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.type).toEqual('blobTrigger')
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
