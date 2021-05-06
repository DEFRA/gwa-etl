function generateUsersToImport (count) {
  const users = []
  for (let i = 0; i < count; i++) {
    users.push({
      emailAddress: `${i}@email.com`
    })
  }
  return users
}

module.exports = {
  generateUsersToImport
}
