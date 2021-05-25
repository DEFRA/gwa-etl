describe('mapPhoneNumbers', () => {
  let mapPhoneNumbers
  let uuid

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    uuid = require('uuid').v4
    jest.mock('uuid')

    mapPhoneNumbers = require('./mapPhoneNumbers')
  })

  test('user with several phone numbers are mapped and returned correctly', () => {
    const phoneNumber1 = '07000111111'
    const phoneNumber2 = '07000222222'
    const phoneNumber3 = '07000333333'
    const user = {
      officeLocation: 'my-officeLocation',
      phoneNumbers: [phoneNumber1, phoneNumber2, phoneNumber3]
    }
    const uuid1 = 'cbdc2207-4e1f-4bfe-a8be-f203e8ead24f'
    const uuid2 = '208ed435-3f54-4f5d-9058-720adfddd034'
    const uuid3 = 'e5ab5240-d615-477a-a2be-1055b611f1fc'
    uuid.mockReturnValueOnce(uuid1)
      .mockReturnValueOnce(uuid2)
      .mockReturnValueOnce(uuid3)

    const mappedPhoneNumbers = mapPhoneNumbers(user)

    expect(mappedPhoneNumbers).toEqual([{
      id: uuid1,
      type: 'corporate',
      number: phoneNumber1,
      subscribedTo: [user.officeLocation]
    }, {
      id: uuid2,
      type: 'corporate',
      number: phoneNumber2,
      subscribedTo: [user.officeLocation]
    }, {
      id: uuid3,
      type: 'corporate',
      number: phoneNumber3,
      subscribedTo: [user.officeLocation]
    }])
  })

  test('user with no phone numbers returns an empty array', () => {
    const user = { }

    const mappedPhoneNumbers = mapPhoneNumbers(user)

    expect(mappedPhoneNumbers).toEqual([])
  })

  test('user with no officeLocation defaults to unknown code', () => {
    const user = { phoneNumbers: ['07000111111'] }

    const mappedPhoneNumbers = mapPhoneNumbers(user)

    expect(mappedPhoneNumbers[0].subscribedTo).toEqual(['UNK:Unknown'])
  })
})
