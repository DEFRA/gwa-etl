const { CosmosClient } = require('@azure/cosmos')

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const importAttemptSleepDuration = process.env.IMPORT_ATTEMPT_SLEEP_DURATION
const importBulkBatchSleepDuration = process.env.IMPORT_BULK_BATCH_SLEEP_DURATION
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

async function sleep (milliseconds) {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function upsert (context, container, usersToUpsert) {
  const userMap = new Map(usersToUpsert.map(user => [user.id, user]))
  const updatedUserSet = new Set()

  let cost = 0
  let count = 0
  const batchSize = 100
  while (usersToUpsert.length) {
    context.log(`Running bulk operation for users in batch group ${count * batchSize + 1} to ${++count * batchSize}.`)
    const operations = []
    const batch = usersToUpsert.splice(0, batchSize)
    for (const user of batch) {
      operations.push({
        operationType: 'Upsert',
        partitionKey: user.id,
        resourceBody: user
      })
    }
    const responses = await container.items.bulk(operations)

    for (const response of responses) {
      switch (response.statusCode) {
        case 200:
          updatedUserSet.add(response?.resourceBody?.id)
          cost += response.requestCharge
          break
        case 429:
          context.log.warn(response)
          break
        default:
          context.log.error(response)
      }
    }
    context.log(`Processing next batch in ${importBulkBatchSleepDuration} milliseconds.`)
    await sleep(importBulkBatchSleepDuration)
  }
  // Remove successful ids from users
  updatedUserSet.forEach(user => userMap.delete(user))

  context.log(`Users updated successfully: ${updatedUserSet.size}\nUsers still to be updated: ${userMap.size}\nCost (RUs): ${cost}.`)

  return {
    cost,
    userMap
  }
}

async function upsertUsers (context, container, allUsers) {
  const { usersCreated, usersInactive, usersUpdated } = allUsers
  const usersToUpsert = [...usersCreated, ...usersInactive, ...usersUpdated]
  let userMap = new Map(usersToUpsert.map(user => [user.id, user]))

  let attempt = 1
  let cost = 0

  do {
    const users = Array.from(userMap.values())
    const res = await upsert(context, container, users)
    userMap = res.userMap
    cost += res.cost

    if (userMap.size) {
      attempt++
      context.log(`Making attempt ${attempt} in ${importAttemptSleepDuration} milliseconds.`)
      await sleep(importAttemptSleepDuration)
    }
  } while (userMap.size && attempt <= 10)

  context.log(`After ${attempt} attempt(s), ${userMap.size} user(s) are still to be updated.`)
  context.log(`Total cost (RUs): ${cost}.`)

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
