const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

async function upsertUsers (context, container, allUsers) {
  const { usersCreated, usersInactive, usersUpdated } = allUsers
  const users = [...usersCreated, ...usersInactive, ...usersUpdated]
  // const updateSuccess = []

  let count = 0
  const batchSize = 100
  while (users.length) {
    context.log(`Running bulk operation for users in batch group ${count * batchSize + 1} to ${++count * batchSize}.`)
    const operations = []
    const batch = users.splice(0, batchSize)
    for (const user of batch) {
      // remove _ props - no need
      // for (const prop in user) {
      //   if (prop.startsWith('_')) {
      //     delete user[prop]
      //   }
      // }
      operations.push({
        operationType: 'Upsert',
        partitionKey: user.id,
        resourceBody: user
      })
    }
    await container.items.bulk(operations)
    // // TODO: handle retries. if any of the response contain a 429, remove others and reprocess
    // const responses = await container.items.bulk(operations) //, { continueOnError: true })
    // context.log(responses)
    // for (const response of responses) {
    //   if (response.statusCode === 429) {
    //     context.log.warn(response)
    //   }
    // }
  }

  context.log(`${usersCreated.length} user(s) created: ${usersCreated.map(user => user.id)}.`)
  context.log(`${usersUpdated.length} user(s) updated: ${usersUpdated.map(user => user.id)}.`)
  context.log(`${usersInactive.length} user(s) inactive: ${usersInactive.map(user => user.id)}.`)
}

async function categoriseUsers (usersToImport, existingUsers) {
  const existingUsersMap = new Map(existingUsers.map(user => [user.id, user]))
  const usersCreated = []
  const usersUpdated = []

  const importDate = Date.now()
  for (const user of usersToImport) {
    const { emailAddress } = user
    user.active = true
    user.id = emailAddress
    user.importDate = importDate
    delete user.emailAddress

    const existingUser = existingUsersMap.get(emailAddress)

    if (existingUser) {
      usersUpdated.push({ ...existingUser, ...user })
      existingUsersMap.delete(emailAddress)
    } else {
      usersCreated.push(user)
    }
  }

  const usersInactive = Array.from(existingUsersMap.values()).map(user => {
    user.active = false
    return user
  })

  return {
    usersCreated,
    usersInactive,
    usersUpdated
  }
}

function getUsersToImport (context) {
  const { blobContents } = context.bindings
  return JSON.parse(blobContents)
}

async function getExistingUsers (container) {
  return (await container.items.query('SELECT * FROM c').fetchAll()).resources
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
    context.log(`Users already existing: ${existingUsers.length}.`)

    const users = await categoriseUsers(usersToImport, existingUsers)

    await upsertUsers(context, usersContainer, users)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
