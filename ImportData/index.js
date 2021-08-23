const { CosmosClient } = require('@azure/cosmos')

const categoriseUsers = require('../lib/categorise-users')
const getActivePhoneNumbers = require('../lib/get-active-phone-numbers')
const upsertUsers = require('../lib/upsert-users')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

function getUsersToImport (context) {
  const { blobContents } = context.bindings
  return JSON.parse(blobContents)
}

async function getExistingUsers (container) {
  return (await container.items.query('SELECT * FROM c').fetchAll()).resources
}

function savePhoneNumbersFile (context, users) {
  const header = 'phone number'
  context.bindings.phoneNumbers = `${header}\n${getActivePhoneNumbers(users).join('\n')}`
}

module.exports = async context => {
  try {
    const usersToImport = getUsersToImport(context)

    if (!usersToImport.length) {
      context.log.warn('No users to import, returning early.')
      return
    }
    context.log(`Users to import: ${usersToImport.length}.`)

    const existingUsers = await getExistingUsers(usersContainer)
    context.log(`Users already existing: ${existingUsers.length}.`)

    const users = categoriseUsers(usersToImport, existingUsers)

    savePhoneNumbersFile(context, users)
    await upsertUsers(context, usersContainer, users)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
