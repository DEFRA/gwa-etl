const { v4: uuid } = require('uuid')
const { phoneNumberTypes } = require('./constants')

/**
 * Returns phone numbers for a user when there is an existing user and a new
 * version of the user.
 *
 * @param {object} existingUser Must have an array of typed `phoneNumbers`
 * (either `corporate` or `personal`).
 * @param {object} newUser Must have an array of typed `phoneNumbers` (either
 * `corporate` or `personal`).
 *
 * @returns {Array} List of phone number objects
 */
function mapExistingUsersPhoneNumbers (existingUser, newUser) {
  const personalPNs = existingUser.phoneNumbers.filter(x => x.type === phoneNumberTypes.personal)
  const newCorporatePNs = newUser.phoneNumbers.filter(x => x.type === phoneNumberTypes.corporate)
  const oldCorporatePNs = existingUser.phoneNumbers.filter(x => x.type === phoneNumberTypes.corporate)

  // Existing user's corporatePN details take precedence.
  const corporatePNs = []
  const oldCorporateNumbers = oldCorporatePNs.map(x => x.number)
  newCorporatePNs.forEach(pn => {
    if (oldCorporateNumbers.includes(pn.number)) {
      corporatePNs.push(oldCorporatePNs.find(x => x.number === pn.number))
    } else {
      corporatePNs.push(pn)
    }
  })
  return personalPNs.concat(corporatePNs)
}

function mapUsersToImportPhoneNumbers (user) {
  return user.phoneNumbers?.map(phoneNumber => {
    return {
      id: uuid(),
      type: phoneNumberTypes.corporate,
      number: phoneNumber,
      subscribedTo: [user.officeCode || 'UNK:Unknown']
    }
  }) ?? []
}

module.exports = {
  mapExistingUsersPhoneNumbers,
  mapUsersToImportPhoneNumbers
}
