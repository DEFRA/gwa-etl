const { mapExistingUsersPhoneNumbers, mapUsersToImportPhoneNumbers } = require('./map-phone-numbers')

module.exports = (usersToImport, existingUsers) => {
  const existingUsersMap = new Map(existingUsers.map(user => [user.id, user]))
  const activeUsers = []

  const importDate = Date.now()
  for (const user of usersToImport) {
    const emailAddress = user.emailAddress.toLowerCase()
    user.active = true
    user.id = emailAddress
    user.importDate = importDate
    user.phoneNumbers = mapUsersToImportPhoneNumbers(user)
    delete user.emailAddress

    const existingUser = existingUsersMap.get(emailAddress)

    if (existingUser) {
      user.phoneNumbers = mapExistingUsersPhoneNumbers(existingUser, user)
      activeUsers.push({ ...existingUser, ...user })
      existingUsersMap.delete(emailAddress)
    } else {
      activeUsers.push(user)
    }
  }

  const inactiveUsers = Array.from(existingUsersMap.values()).map(user => {
    user.active = false
    return user
  })

  return {
    activeUsers,
    inactiveUsers
  }
}
