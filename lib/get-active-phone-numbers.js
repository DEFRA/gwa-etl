const phonelib = require('google-libphonenumber')

const formats = phonelib.PhoneNumberFormat
const phoneUtil = phonelib.PhoneNumberUtil.getInstance()

function getNationalFormat (phoneNumber) {
  const parsed = phoneUtil.parse(phoneNumber, 'GB')
  return phoneUtil.format(parsed, formats.NATIONAL)
}

/**
 * Returns a list of unique phone numbers (formatted in the national format)
 * from active users.
 *
 * @param {Array} activeUsers Users containing a `phoneNumbers` property (an
 * array of phone numbers).
 *
 * @returns {Array} List of unique, active phone numbers.
 */
function getActivePhoneNumbers (activeUsers) {
  const phoneNumbers = []
  activeUsers.forEach(u => phoneNumbers.push(u.phoneNumbers.map(pn => getNationalFormat(pn.number))))
  return [...new Set(phoneNumbers.flat())]
}

module.exports = getActivePhoneNumbers
