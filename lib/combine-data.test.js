describe('Combine user data', () => {
  const combineData = require('./combine-data')

  test('a user matching on email address is fully combined', () => {
    const emailAddress = 'a@a.com'
    const users1 = [{ emailAddress, phoneNumbers: ['07700111222'] }]
    const users2 = [{ emailAddress, location: 'home' }]

    const combinedUsers = combineData(users1, users2)

    expect(combinedUsers).toHaveLength(1)
    expect(combinedUsers[0]).toEqual({
      emailAddress,
      phoneNumbers: users1[0].phoneNumbers,
      location: users2[0].location
    })
  })

  test('users not matched in either set are returned', () => {
    const emailAddress = 'a@a.com'
    const users1 = [{ emailAddress, phoneNumbers: ['07700111222'] }]
    const users2 = [{ emailAddress: 'b@bb.com', location: 'home' }]

    const combinedUsers = combineData(users1, users2)

    expect(combinedUsers).toHaveLength(2)
    expect(combinedUsers[0]).toEqual(users1[0])
    expect(combinedUsers[1]).toEqual(users2[0])
  })

  test('a mix of users with matching email addresses and users not matched are returned', () => {
    const emailAddress = 'a@a.com'
    const users1 = [{ emailAddress, phoneNumbers: ['07700111222'] }, { emailAddress: 'c@c.com', phoneNumbers: ['07700112233'] }]
    const users2 = [{ emailAddress: 'b@bb.com', location: 'home' }, { emailAddress, location: 'away' }]

    const combinedUsers = combineData(users1, users2)

    expect(combinedUsers).toHaveLength(3)
    expect(combinedUsers[0]).toEqual({
      emailAddress,
      phoneNumbers: users1[0].phoneNumbers,
      location: users2[1].location
    })
    expect(combinedUsers[1]).toEqual({
      emailAddress: users1[1].emailAddress,
      phoneNumbers: users1[1].phoneNumbers
    })
    expect(combinedUsers[2]).toEqual({
      emailAddress: users2[0].emailAddress,
      location: users2[0].location,
      phoneNumbers: []
    })
  })

  test('users with no phoneNumbers have an empty array added in either set', () => {
    const emailAddress = 'a@a.com'
    const users1 = [{ emailAddress }, { emailAddress: 'c@c.com' }]
    const users2 = [{ emailAddress: 'b@bb.com', location: 'home' }, { emailAddress, location: 'away' }]

    const combinedUsers = combineData(users1, users2)

    expect(combinedUsers).toHaveLength(3)
    expect(combinedUsers[0]).toEqual({
      emailAddress,
      phoneNumbers: [],
      location: users2[1].location
    })
    expect(combinedUsers[1]).toEqual({
      emailAddress: users1[1].emailAddress,
      phoneNumbers: []
    })
    expect(combinedUsers[2]).toEqual({
      emailAddress: users2[0].emailAddress,
      location: users2[0].location,
      phoneNumbers: []
    })
  })
})
