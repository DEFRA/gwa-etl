const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

module.exports = async function (context) {
  try {
    const queryResponse = await usersContainer.items.query('SELECT c.id FROM c').fetchAll()
    const existingUserIds = new Set(queryResponse.resources.map(r => r.id))
    context.log(`Users already existing: ${existingUserIds.size}.`)

    const { blobContents } = context.bindings
    const usersToImport = JSON.parse(blobContents)
    context.log(`Users to import: ${usersToImport.length}.`)

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

    context.log(`Users created: ${usersCreated.length}. Users updated: ${usersUpdated.length}. Users inactive: ${usersInactive.length}.`)
    // TODO: Consider using bindings for new users.
    // context.bindings.users = usersToImport
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
