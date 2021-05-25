const { v4: uuid } = require('uuid')

module.exports = user => {
  return user.phoneNumbers?.map(phoneNumber => {
    return {
      id: uuid(),
      type: 'corporate',
      number: phoneNumber,
      subscribedTo: [user.officeLocation || 'UNK:Unknown']
    }
  }) ?? []
}
