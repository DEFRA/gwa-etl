const inputBindingName = 'blobContents'
const outputBindingName = 'users'

describe('ImportData function', () => {
  const importData = require('.')

  const context = require('../test/defaultContext')

  test('incoming file contents are saved to output binding with email as id', async () => {
    const userData = [{ emailAddress: 'a@a.com', phoneNumbers: ['07000111222'] }]
    context.bindings[inputBindingName] = Buffer.from(JSON.stringify(userData))

    await importData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toHaveLength(1)
    const outputUser = context.bindings[outputBindingName][0]
    expect(outputUser).toMatchObject({
      id: userData[0].emailAddress,
      phoneNumbers: userData[0].phoneNumbers
    })
    expect(outputUser).not.toMatchObject({ emailAddress: userData[0].emailAddress })
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

  test('blobTrigger input binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')

    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(inputBindingName)
    expect(binding.type).toEqual('blobTrigger')
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
