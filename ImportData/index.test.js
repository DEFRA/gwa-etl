const inputBindingName = 'myBlob'
const inputBlobBindingName = 'allUsers'
const outputBindingName = 'users'

describe('ImportData function', () => {
  const importData = require('.')

  const context = require('../test/defaultContext')

  test('incoming file contents are saved to output binding', async () => {
    const inputFileContents = []
    context.bindings[inputBlobBindingName] = inputFileContents

    await importData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toEqual(inputFileContents)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Doesn't matter what causes the error, just that an error is thrown
    context.bindings = null

    await expect(importData(context)).rejects.toThrow(Error)
    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('ImportData bindings', () => {
  const { bindings: functionBindings } = require('./function')

  const testEnvVars = require('../test/testEnvVars')
  const { allUsersFilename } = require('../lib/config')

  const inputBindings = functionBindings.filter((binding) => binding.direction === 'in')

  test('two input bindings exist', () => {
    expect(inputBindings).toHaveLength(2)
  })

  test('blobTrigger input binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blobTrigger')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${allUsersFilename}`)
  })

  test('blob binding is correct', () => {
    const bindings = inputBindings.filter(b => b.type === 'blob')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBlobBindingName)
    expect(binding.path).toEqual(`%${testEnvVars.DATA_IMPORT_CONTAINER}%/${allUsersFilename}`)
  })

  test('cosmos output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('cosmosDB')
    expect(binding.databaseName).toEqual('gwa')
    expect(binding.collectionName).toEqual(`%${testEnvVars.COSMOS_DB_USERS_CONTAINER}%`)
  })
})
