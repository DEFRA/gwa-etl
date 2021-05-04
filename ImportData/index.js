const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

module.exports = async function (context) {
  try {
    const { blobContents } = context.bindings
    const usersToImport = JSON.parse(blobContents)

    if (!usersToImport.length) {
      context.log.warn('No users to import, returning early.')
      return
    }
    context.log(`Users to import: ${usersToImport.length}.`)

    const queryResponse = await usersContainer.items.query('SELECT c.id FROM c').fetchAll()
    const existingUserIds = new Set(queryResponse.resources.map(r => r.id))
    context.log(`Users already existing: ${existingUserIds.size}.`)

    const usersCreated = []
    const usersUpdated = []
    const usersInactive = []

    // TODO: refactor to function
    const importDate = Date.now()
    for (const user of usersToImport) {
      const { emailAddress } = user
      user.active = true
      user.id = emailAddress
      user.importDate = importDate
      delete user.emailAddress

      const { resource } = await usersContainer.item(emailAddress, emailAddress).read()

      if (resource) {
        usersUpdated.push(emailAddress)
        await usersContainer.item(emailAddress, emailAddress).replace({ ...resource, ...user })
        existingUserIds.delete(emailAddress)
      } else {
        // Could potentially use output binding for new users...?
        usersCreated.push(emailAddress)
        await usersContainer.items.create(user)
      }
    }

    // TODO: refactor to function
    for (const emailAddress of existingUserIds) {
      usersInactive.push(emailAddress)
      const { resource } = await usersContainer.item(emailAddress, emailAddress).read()
      resource.active = false
      await usersContainer.item(emailAddress, emailAddress).replace(resource)
    }

    context.log(`${usersCreated.length} user(s) created: ${usersCreated}.`)
    context.log(`${usersUpdated.length} user(s) updated: ${usersUpdated}.`)
    context.log(`${usersInactive.length} user(s) inactive: ${usersInactive}.`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
