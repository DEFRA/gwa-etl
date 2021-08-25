function pluralise (count) {
  return count === 1 ? 'user was' : 'users were'
}

module.exports = users => {
  const { usersCreated, usersInactive, usersUpdated } = users
  const usersCreatedCount = usersCreated.length
  const usersInactiveCount = usersInactive.length
  const usersUpdatedCount = usersUpdated.length

  return 'Import was successful.\n' +
    `${usersCreatedCount} ${pluralise(usersCreatedCount)} created.\n` +
    `${usersUpdatedCount} ${pluralise(usersUpdatedCount)} updated.\n` +
    `${usersInactiveCount} ${pluralise(usersInactiveCount)} set inactive.`
}
