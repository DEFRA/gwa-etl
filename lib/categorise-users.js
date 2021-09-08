const { mapExistingUsersPhoneNumbers, mapUsersToImportPhoneNumbers } = require('./map-phone-numbers')

module.exports = (usersToImport, existingUsers, orgListRefData) => {
  const activeUsers = []
  const inactiveUsers = []
  const importDate = Date.now()
  const existingUsersMap = new Map(existingUsers.map(user => [user.id, user]))
  const orgStatusMap = new Map(orgListRefData.map(org => [org.orgCode, org.active]))

  usersToImport.forEach(user => {
    const emailAddress = user.emailAddress.toLowerCase()
    user.id = emailAddress
    user.importDate = importDate
    user.phoneNumbers = mapUsersToImportPhoneNumbers(user)
    delete user.emailAddress

    const existingUser = existingUsersMap.get(emailAddress)

    if (existingUser) {
      user.phoneNumbers = mapExistingUsersPhoneNumbers(existingUser, user)
      user = { ...existingUser, ...user }
      existingUsersMap.delete(emailAddress)
    }

    user.active = orgStatusMap.get(user.orgCode)
    if (user.active) {
      activeUsers.push(user)
    } else {
      inactiveUsers.push(user)
    }
  })

  inactiveUsers.push(...Array.from(existingUsersMap.values()).map(user => {
    user.active = false
    return user
  }))

  return {
    activeUsers,
    inactiveUsers
  }
}
