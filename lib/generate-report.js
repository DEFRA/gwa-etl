module.exports = users => {
  const { usersCreated, usersInactive, usersUpdated } = users
  return 'Import was successful.\n' +
    `${usersCreated.length} users were created.\n` +
    `${usersUpdated.length} users were updated.\n` +
    `${usersInactive.length} users were set inactive.`
}
