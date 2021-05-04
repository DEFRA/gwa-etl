const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

async function setUsersInactive (container, emailAddresses) {
  const usersInactive = []
  for (const emailAddress of emailAddresses) {
    usersInactive.push(emailAddress)
    const { resource } = await container.item(emailAddress, emailAddress).read()
    resource.active = false
    await container.item(emailAddress, emailAddress).replace(resource)
  }
  return usersInactive
}

async function createOrUpdateUsers (container, usersToImport, existingUserIds) {
  const usersCreated = []
  const usersUpdated = []

  const importDate = Date.now()
  for (const user of usersToImport) {
    const { emailAddress } = user
    user.active = true
    user.id = emailAddress
    user.importDate = importDate
    delete user.emailAddress

    const { resource } = await container.item(emailAddress, emailAddress).read()

    if (resource) {
      usersUpdated.push(emailAddress)
      await container.item(emailAddress, emailAddress).replace({ ...resource, ...user })
      existingUserIds.delete(emailAddress)
    } else {
      usersCreated.push(emailAddress)
      await container.items.create(user)
    }
  }
  return { usersCreated, usersUpdated }
}

function getUsersToImport (context) {
  const { blobContents } = context.bindings
  return JSON.parse(blobContents)
}

async function getExistingUsers (container) {
  const queryResponse = await container.items.query('SELECT c.id FROM c').fetchAll()
  return new Set(queryResponse.resources.map(r => r.id))
}

module.exports = async function (context) {
  try {
    const usersToImport = getUsersToImport(context)

    if (!usersToImport.length) {
      context.log.warn('No users to import, returning early.')
      return
    }
    context.log(`Users to import: ${usersToImport.length}.`)

    const existingUserIds = await getExistingUsers(usersContainer)
    context.log(`Users already existing: ${existingUserIds.size}.`)

    const { usersCreated, usersUpdated } = await createOrUpdateUsers(usersContainer, usersToImport, existingUserIds)

    const usersInactive = await setUsersInactive(usersContainer, existingUserIds)

    context.log(`${usersCreated.length} user(s) created: ${usersCreated}.`)
    context.log(`${usersUpdated.length} user(s) updated: ${usersUpdated}.`)
    context.log(`${usersInactive.length} user(s) inactive: ${usersInactive}.`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
