const { ContainerClient } = require('@azure/storage-blob')
const getContainerContents = require('../lib/get-container-contents')
const validateUsers = require('../lib/validate-users')

const connectionString = process.env.AzureWebJobsStorage
const dataSourcesContainer = process.env.DATA_SOURCES_CONTAINER
const containerClient = new ContainerClient(connectionString, dataSourcesContainer)

module.exports = async function (context) {
  try {
    const { blobTrigger, userDataBlobName } = context.bindingData
    const { blobContents } = context.bindings
    context.log(`Combine Data Sources Blob Trigger function activated:\n - Blob: ${blobTrigger}\n - Name: ${userDataBlobName}\n - Size: ${blobContents.length} Bytes`)

    const values = await getContainerContents(containerClient)
    const internalUsers = [values.splice(0, 1)[0] ?? []].flat()
    const internalUserMap = new Map(internalUsers.map(user => [user.emailAddress, user]))

    // Check for duplicates against internalUsers
    const internalDuplicateUsers = []
    const nonInternalUsers = values
      .filter(x => x)
      .flat()
      .filter(user => {
        if (internalUserMap.has(user.emailAddress)) {
          internalDuplicateUsers.push(user)
          return false
        }
        return true
      })

    // Find duplicate users within non internal
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

    // Remove duplicates
    const nonInternalDuplicateUsers = []
    const nonInternalNonDuplicateUsers = [...nonInternalUserMap.values()].filter(({ count, user }) => {
      if (count === 1) {
        return true
      }
      nonInternalDuplicateUsers.push(user)
      return false
    })

    const users = internalUsers.concat(nonInternalNonDuplicateUsers)

    const { errorUsers, validUsers } = validateUsers(users)

    context.bindings.validUsers = validUsers
    context.bindings.errorUsers = errorUsers
    context.bindings.duplicateUsers = internalDuplicateUsers.concat(nonInternalDuplicateUsers)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
