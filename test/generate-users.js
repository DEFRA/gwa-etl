const { v4: uuid } = require('uuid')

function generateUsersToImport (count) {
  const users = []
  for (let i = 0; i < count; i++) {
    users.push({
      emailAddress: `${i}@email.com`
    })
  }
  return users
}

function generateUsersWithId (count) {
  const users = []
  for (let i = 0; i < count; i++) {
    const id = uuid()
    users.push({
      mail: `${id}@email.com`.toUpperCase(),
      givenName: id.slice(0, 8),
      surname: id.slice(9, 13),
      companyName: 'companyName',
      officeLocation: 'officeLocation'
    })
  }
  return users
}

module.exports = {
  generateUsersToImport,
  generateUsersWithId
}
