const generateReport = require('../lib/generate-report')

const importAttemptSleepDuration = process.env.IMPORT_ATTEMPT_SLEEP_DURATION
const importBulkBatchSleepDuration = process.env.IMPORT_BULK_BATCH_SLEEP_DURATION

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
        case 201:
          updatedUserSet.add(response.resourceBody?.id)
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

module.exports = async (context, container, allUsers) => {
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

  context.log(generateReport(allUsers))
}
