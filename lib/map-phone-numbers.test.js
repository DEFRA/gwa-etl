describe('map phone numbers', () => {
  const { mapExistingUsersPhoneNumbers, mapUsersToImportPhoneNumbers } = require('./map-phone-numbers')
  const { phoneNumberTypes } = require('./constants')
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  describe('map phone numbers for existing users', () => {
    test('no phone numbers are mapped correctly', () => {
      const existingUser = { phoneNumbers: [] }
      const newUser = { phoneNumbers: [] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(0)
      expect(mappedPhoneNumbers).toEqual([])
    })

    test('personal phone numbers are returned untouched', () => {
      const existingUser = { phoneNumbers: [{ type: phoneNumberTypes.personal }] }
      const newUser = { phoneNumbers: [] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(1)
      expect(mappedPhoneNumbers).toEqual(existingUser.phoneNumbers)
    })

    test('new corporate phone numbers are returned', () => {
      const existingUser = { phoneNumbers: [] }
      const newUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate }] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(1)
      expect(mappedPhoneNumbers).toEqual(newUser.phoneNumbers)
    })

    test('existing corporate phone number is not returned when not included on newUser', () => {
      const existingUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate }] }
      const newUser = { phoneNumbers: [] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(0)
      expect(mappedPhoneNumbers).toEqual([])
    })

    test('existing corporate phone number is returned when included on newUser', () => {
      const existingUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate, subscribedTo: ['HERE'] }] }
      const newUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate }] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(1)
      expect(mappedPhoneNumbers).toEqual(existingUser.phoneNumbers)
    })

    test('existing corporate phone number is returned when included on newUser along with new corporate phone number', () => {
      const existingUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate, subscribedTo: ['HERE'] }] }
      const newUser = { phoneNumbers: [{ number: '07777111111', type: phoneNumberTypes.corporate }, { number: '07777222222', type: phoneNumberTypes.corporate }] }

      const mappedPhoneNumbers = mapExistingUsersPhoneNumbers(existingUser, newUser)

      expect(mappedPhoneNumbers).toHaveLength(2)
      expect(mappedPhoneNumbers[0]).toEqual(existingUser.phoneNumbers[0])
      expect(mappedPhoneNumbers[1]).toEqual(newUser.phoneNumbers[1])
    })
  })

  describe('map phone numbers for users being imported', () => {
    test('user with several phone numbers are mapped and returned correctly', () => {
      const phoneNumber1 = '07700111111'
      const phoneNumber2 = '07700222222'
      const phoneNumber3 = '07700333333'
      const user = {
        officeCode: 'MOC:my-office-code',
        phoneNumbers: [phoneNumber1, phoneNumber2, phoneNumber3]
      }

      const mappedPhoneNumbers = mapUsersToImportPhoneNumbers(user)

      expect(mappedPhoneNumbers).toEqual([{
        id: expect.stringMatching(uuidRegex),
        type: phoneNumberTypes.corporate,
        number: phoneNumber1,
        subscribedTo: [user.officeCode]
      }, {
        id: expect.stringMatching(uuidRegex),
        type: phoneNumberTypes.corporate,
        number: phoneNumber2,
        subscribedTo: [user.officeCode]
      }, {
        id: expect.stringMatching(uuidRegex),
        type: phoneNumberTypes.corporate,
        number: phoneNumber3,
        subscribedTo: [user.officeCode]
      }])
    })

    test('user with no phone numbers returns an empty array', () => {
      const user = { }

      const mappedPhoneNumbers = mapUsersToImportPhoneNumbers(user)

      expect(mappedPhoneNumbers).toEqual([])
    })

    test('user with no officeCode defaults to unknown code', () => {
      const user = { phoneNumbers: ['07700111111'] }

      const mappedPhoneNumbers = mapUsersToImportPhoneNumbers(user)

      expect(mappedPhoneNumbers[0].subscribedTo).toEqual(['UNK:Unknown'])
    })
  })
})
