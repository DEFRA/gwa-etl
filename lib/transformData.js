const { v4: uuid } = require('uuid')

module.exports = (users) => {
  users.forEach(user => {
    const phoneNumbers = user.phoneNumbers.map(phoneNumber => {
      return {
        id: uuid(),
        type: 'corporate',
        number: phoneNumber,
        subscribedTo: [user.officeLocation]
      }
    })
    user.phoneNumbers = phoneNumbers
    user.id = user.emailAddress
    delete user.emailAddress
  })
  return users
}
