const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

async function setUsersInactive (container, existingUsers) {
  for (const user of existingUsers.values()) {
    user.active = false
    await container.item(user.id, user.id).replace(user)
  }
}

async function createOrUpdateUsers (container, usersToImport, existingUsers) {
  const usersCreated = []
  const usersUpdated = []

  const importDate = Date.now()
  for (const user of usersToImport) {
    const { emailAddress } = user
    user.active = true
    user.id = emailAddress
    user.importDate = importDate
    delete user.emailAddress

    const existingUser = existingUsers.get(emailAddress)

    if (existingUser) {
      usersUpdated.push(emailAddress)
      await container.item(emailAddress, emailAddress).replace({ ...existingUser, ...user })
      existingUsers.delete(emailAddress)
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
  const queryResponse = await container.items.query('SELECT * FROM c').fetchAll()
  return new Map(queryResponse.resources.map(r => [r.id, r]))
}

module.exports = async function (context) {
  try {
    const usersToImport = getUsersToImport(context)

    if (!usersToImport.length) {
      context.log.warn('No users to import, returning early.')
      return
    }
    context.log(`Users to import: ${usersToImport.length}.`)

    const existingUsers = await getExistingUsers(usersContainer)
    context.log(`Users already existing: ${existingUsers.size}.`)

    const { usersCreated, usersUpdated } = await createOrUpdateUsers(usersContainer, usersToImport, existingUsers)

    await setUsersInactive(usersContainer, existingUsers)

    context.log(`${usersCreated.length} user(s) created: ${usersCreated}.`)
    context.log(`${usersUpdated.length} user(s) updated: ${usersUpdated}.`)
    context.log(`${existingUsers.size} user(s) inactive: ${Array.from(existingUsers.keys())}.`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
