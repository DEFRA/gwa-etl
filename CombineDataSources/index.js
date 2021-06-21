const { ContainerClient } = require('@azure/storage-blob')
const getContainerContents = require('../lib/get-container-contents')
const validateUsers = require('../lib/validate-users')

const connectionString = process.env.AzureWebJobsStorage
const dataSourcesContainer = process.env.DATA_SOURCES_CONTAINER
const containerClient = new ContainerClient(connectionString, dataSourcesContainer)

function getInternalUsers (containerContents) {
  return [containerContents.splice(0, 1)[0] ?? []].flat()
}

function getAllNonInternalUsers (containerContents) {
  return containerContents.filter(x => x).flat()
}

function categoriseInternalUsers (internalUsers, nonInternalUsersPossibleDuplicates) {
  const internalUserMap = new Map(internalUsers.map(user => [user.emailAddress, user]))

  const internalDuplicateUsers = []
  const nonInternalUsers = nonInternalUsersPossibleDuplicates
    .filter(user => {
      if (internalUserMap.has(user.emailAddress)) {
        internalDuplicateUsers.push(user)
        return false
      }
      return true
    })
  return {
    internalDuplicateUsers,
    nonInternalUsers
  }
}

function categoriseNonInternalUsers (nonInternalUserMap) {
  const nonInternalDuplicateUsers = []
  const nonInternalNonDuplicateUsers = []

  nonInternalUserMap.forEach(({ count, user }) => {
    count === 1
      ? nonInternalNonDuplicateUsers.push(user)
      : nonInternalDuplicateUsers.push(user)
  })
  return {
    nonInternalDuplicateUsers,
    nonInternalNonDuplicateUsers
  }
}

function createMapOfNonInternalUsersWithCount (nonInternalUsers) {
  const nonInternalUserMap = new Map()
  nonInternalUsers.forEach(user => {
    const emailAddress = user.emailAddress
    const emailCount = nonInternalUserMap.get(emailAddress)
    if (emailCount?.count) {
      emailCount.count++
    } else {
      nonInternalUserMap.set(emailAddress, { user, count: 1 })
    }
  })
  return nonInternalUserMap
}

module.exports = async function (context) {
  try {
    const { blobTrigger, userDataBlobName } = context.bindingData
    const { blobContents } = context.bindings
    context.log(`Combine Data Sources Blob Trigger function activated:\n - Blob: ${blobTrigger}\n - Name: ${userDataBlobName}\n - Size: ${blobContents.length} Bytes`)

    const containerContents = await getContainerContents(containerClient)
    const internalNonDuplicateUsers = getInternalUsers(containerContents)
    const allNonInternalUsers = getAllNonInternalUsers(containerContents)
    const { internalDuplicateUsers, nonInternalUsers } = categoriseInternalUsers(internalNonDuplicateUsers, allNonInternalUsers)
    const nonInternalUserMapWithCount = createMapOfNonInternalUsersWithCount(nonInternalUsers)
    const { nonInternalDuplicateUsers, nonInternalNonDuplicateUsers } = categoriseNonInternalUsers(nonInternalUserMapWithCount)

    const nonDuplicateUsers = internalNonDuplicateUsers.concat(nonInternalNonDuplicateUsers)

    const { errorUsers, validUsers } = validateUsers(nonDuplicateUsers)
    const duplicateUsers = internalDuplicateUsers.concat(nonInternalDuplicateUsers)

    context.bindings.validUsers = validUsers
    context.bindings.errorUsers = errorUsers
    context.bindings.duplicateUsers = duplicateUsers
    context.log(`Valid user count: ${validUsers.length}\nError user count: ${errorUsers.length}\nDuplicate user count: ${duplicateUsers.length}`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
