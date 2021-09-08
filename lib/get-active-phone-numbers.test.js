describe('Get Active Phone Numbers', () => {
  const getPhoneNumbers = require('./get-active-phone-numbers')

  test('no users returns an empty array', () => {
    const users = []

    const phoneNumbers = getPhoneNumbers(users)

    expect(phoneNumbers).toHaveLength(0)
    expect(phoneNumbers).toEqual([])
  })

  test('phone numbers are formatted in national format', () => {
    const users = [{ phoneNumbers: [{ number: '+447700111222' }] }]

    const phoneNumbers = getPhoneNumbers(users)

    expect(phoneNumbers).toHaveLength(1)
    expect(phoneNumbers[0]).toEqual('07700 111222')
  })

  test('multiple phone numbers for users are returned', () => {
    const users = [
      { phoneNumbers: [{ number: '+447700111222' }, { number: '+447700222333' }] },
      { phoneNumbers: [{ number: '+447700333444' }, { number: '+447700444555' }] }
    ]

    const phoneNumbers = getPhoneNumbers(users)

    expect(phoneNumbers).toHaveLength(4)
    expect(phoneNumbers[0]).toEqual('07700 111222')
    expect(phoneNumbers[1]).toEqual('07700 222333')
    expect(phoneNumbers[2]).toEqual('07700 333444')
    expect(phoneNumbers[3]).toEqual('07700 444555')
  })

  test('only unique phone numbers are returned', () => {
    const users = [
      { phoneNumbers: [{ number: '+447700111222' }] },
      { phoneNumbers: [{ number: '+447700111222' }, { number: '+447700111222' }] }
    ]

    const phoneNumbers = getPhoneNumbers(users)

    expect(phoneNumbers).toHaveLength(1)
    expect(phoneNumbers[0]).toEqual('07700 111222')
  })
})
