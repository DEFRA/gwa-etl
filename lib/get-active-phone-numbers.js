const phonelib = require('google-libphonenumber')

const formats = phonelib.PhoneNumberFormat
const phoneUtil = phonelib.PhoneNumberUtil.getInstance()

function getNationalFormat (phoneNumber) {
  const parsed = phoneUtil.parse(phoneNumber, 'GB')
  return phoneUtil.format(parsed, formats.NATIONAL)
}

/**
 * Returns all phone numbers (formatted in the national format) from active
 * users.
 *
 * @param {Array} users Must have properties `usersCreated` and `usersUpdated`,
 * each an array of users containing a `phoneNumbers` property (an array of
 * phone numbers).
 *
 * @returns {Array} List of active phone numbers.
 */
function getActivePhoneNumbers (users) {
  const phoneNumbers = []
  users.usersCreated.forEach(u => phoneNumbers.push(u.phoneNumbers.map(pn => getNationalFormat(pn.number))))
  users.usersUpdated.forEach(u => phoneNumbers.push(u.phoneNumbers.map(pn => getNationalFormat(pn.number))))
  return phoneNumbers.flat()
}

module.exports = getActivePhoneNumbers
