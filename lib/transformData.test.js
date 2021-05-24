describe('transformData', () => {
  const uuidVal = 'd961effb-6779-4a90-ab51-86c2086de339'
  let transformData
  let uuid

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    uuid = require('uuid').v4
    jest.mock('uuid')
    uuid.mockReturnValue(uuidVal)

    transformData = require('./transformData')
  })

  test('single user with single phone number is returned with required properties', () => {
    const emailAddress = 'a@a.com'
    const phoneNumber = '07000111222'
    const user1 = {
      emailAddress,
      companyName: 'my-companyName',
      officeLocation: 'my-officeLocation',
      surname: 'my-surname',
      givenName: 'my-givenName',
      phoneNumbers: [phoneNumber]
    }
    const users = [user1]

    const transformedData = transformData(users)

    expect(transformedData).toHaveLength(1)
    expect(transformedData[0]).toEqual({
      id: emailAddress,
      phoneNumbers: [{
        id: uuidVal,
        type: 'corporate',
        number: phoneNumber,
        subscribedTo: [user1.officeLocation]
      }],
      companyName: user1.companyName,
      officeLocation: user1.officeLocation,
      surname: user1.surname,
      givenName: user1.givenName
    })
  })

  test('several users with several phone numbers are returned with required properties', () => {
    const emailAddressUser1 = 'a@a.com'
    const emailAddressUser2 = 'b@b.com'
    const phoneNumber1 = '07000111111'
    const phoneNumber2 = '07000222222'
    const phoneNumber3 = '07000333333'
    const user1 = {
      emailAddress: emailAddressUser1,
      companyName: 'my-companyName',
      officeLocation: 'my-officeLocation',
      surname: 'my-surname',
      givenName: 'my-givenName',
      phoneNumbers: [phoneNumber1, phoneNumber3]
    }
    const user2 = {
      emailAddress: emailAddressUser2,
      companyName: 'my-companyName-2',
      officeLocation: 'my-officeLocation-2',
      surname: 'my-surname-2',
      givenName: 'my-givenName-2',
      phoneNumbers: [phoneNumber1, phoneNumber2, phoneNumber3]
    }
    const users = [user1, user2]
    const uuid1 = 'cbdc2207-4e1f-4bfe-a8be-f203e8ead24f'
    const uuid2 = '208ed435-3f54-4f5d-9058-720adfddd034'
    const uuid3 = 'e5ab5240-d615-477a-a2be-1055b611f1fc'
    const uuid4 = 'cca10e5f-c636-4860-93be-c22c556fcf6e'
    const uuid5 = '8b9b6ef9-7737-49a0-917b-22982cb3e94c'
    uuid.mockReturnValueOnce(uuid1)
      .mockReturnValueOnce(uuid2)
      .mockReturnValueOnce(uuid3)
      .mockReturnValueOnce(uuid4)
      .mockReturnValueOnce(uuid5)

    const transformedData = transformData(users)

    expect(transformedData).toHaveLength(2)
    expect(transformedData[0]).toEqual({
      id: emailAddressUser1,
      phoneNumbers: [{
        id: uuid1,
        type: 'corporate',
        number: phoneNumber1,
        subscribedTo: [user1.officeLocation]
      }, {
        id: uuid2,
        type: 'corporate',
        number: phoneNumber3,
        subscribedTo: [user1.officeLocation]
      }],
      companyName: user1.companyName,
      officeLocation: user1.officeLocation,
      surname: user1.surname,
      givenName: user1.givenName
    })
    expect(transformedData[1]).toEqual({
      id: emailAddressUser2,
      phoneNumbers: [{
        id: uuid3,
        type: 'corporate',
        number: phoneNumber1,
        subscribedTo: [user2.officeLocation]
      }, {
        id: uuid4,
        type: 'corporate',
        number: phoneNumber2,
        subscribedTo: [user2.officeLocation]
      }, {
        id: uuid5,
        type: 'corporate',
        number: phoneNumber3,
        subscribedTo: [user2.officeLocation]
      }],
      companyName: user2.companyName,
      officeLocation: user2.officeLocation,
      surname: user2.surname,
      givenName: user2.givenName
    })
  })
})
