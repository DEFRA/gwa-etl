const { mapExistingUsersPhoneNumbers, mapUsersToImportPhoneNumbers } = require('./map-phone-numbers')

module.exports = (usersToImport, existingUsers) => {
  const existingUsersMap = new Map(existingUsers.map(user => [user.id, user]))
  const usersCreated = []
  const usersUpdated = []

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
