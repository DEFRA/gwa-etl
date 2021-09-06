function pluralise (count) {
  return count === 1 ? 'user was' : 'users were'
}

module.exports = users => {
  const { activeUsers, inactiveUsers } = users
  const activeUserCount = activeUsers.length
  const inactiveUserCount = inactiveUsers.length

  return 'Import was successful.\n' +
    `${activeUserCount} ${pluralise(activeUserCount)} set active.\n` +
    `${inactiveUserCount} ${pluralise(inactiveUserCount)} set inactive.`
}
