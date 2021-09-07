describe('Categorise users', () => {
  let categoriseUsers

  const now = Date.now()
  Date.now = jest.fn(() => now)

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    categoriseUsers = require('./categorise-users')
  })

  function expectPropertiesToExist (categorisedUsers) {
    expect(categorisedUsers).toHaveProperty('activeUsers')
    expect(categorisedUsers).toHaveProperty('inactiveUsers')
  }

  test('empty arrays are returned when no users to import', async () => {
    const usersToImport = []
    const existingUsers = []

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers, [])

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.activeUsers).toEqual([])
    expect(categorisedUsers.inactiveUsers).toEqual([])
  })

  test.each([
    { active: true },
    { active: false }
  ])('a new user\'s active state is set based on org state', async ({ active }) => {
    const emailAddress = 'abc@domain.com'
    const orgCode = 'ABC'
    const usersToImport = [{ emailAddress, orgCode }]
    const existingUsers = []
    const orgListRefData = [{ active, orgCode }]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers, orgListRefData)

    expectPropertiesToExist(categorisedUsers)
    if (active) {
      expect(categorisedUsers.activeUsers).toHaveLength(1)
      expect(categorisedUsers.activeUsers[0]).toEqual({
        active: true,
        id: emailAddress.toLowerCase(),
        importDate: now,
        orgCode,
        phoneNumbers: []
      })
      expect(categorisedUsers.inactiveUsers).toHaveLength(0)
    } else {
      expect(categorisedUsers.activeUsers).toHaveLength(0)
      expect(categorisedUsers.inactiveUsers).toHaveLength(1)
      expect(categorisedUsers.inactiveUsers[0]).toEqual({
        active: false,
        id: emailAddress.toLowerCase(),
        importDate: now,
        orgCode,
        phoneNumbers: []
      })
    }
  })

  test.each([
    { active: true, emailAddress: 'ABC@DOMAIN.COM' },
    { active: false, emailAddress: 'ABC@DOMAIN.COM' }
  ])('an existing user included in the users being imported has their active state set based on org state', async ({ active, emailAddress }) => {
    const orgCode = 'ABC'
    const usersToImport = [{ emailAddress, orgCode }]
    const existingUsers = [{ id: emailAddress.toLowerCase(), orgCode, phoneNumbers: [] }]
    const orgListRefData = [{ active, orgCode }]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers, orgListRefData)

    expectPropertiesToExist(categorisedUsers)
    if (active) {
      expect(categorisedUsers.activeUsers).toHaveLength(1)
      expect(categorisedUsers.activeUsers[0]).toEqual({
        active: true,
        id: emailAddress.toLowerCase(),
        importDate: now,
        orgCode,
        phoneNumbers: []
      })
      expect(categorisedUsers.inactiveUsers).toHaveLength(0)
    } else {
      expect(categorisedUsers.activeUsers).toHaveLength(0)
      expect(categorisedUsers.inactiveUsers).toHaveLength(1)
      expect(categorisedUsers.inactiveUsers[0]).toEqual({
        active: false,
        id: emailAddress.toLowerCase(),
        importDate: now,
        orgCode,
        phoneNumbers: []
      })
    }
  })

  test.each([
    { active: true },
    { active: false }
  ])('an existing user not included in the users being imported set to inactive regardless of the org state', async ({ active }) => {
    const emailAddress = 'abc@domain.com'
    const orgCode = 'ABC'
    const previousImportDate = 12345567890
    const usersToImport = []
    const existingUsers = [{ id: emailAddress, importDate: previousImportDate, orgCode, phoneNumbers: [] }]
    const orgListRefData = [{ active, orgCode }]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers, orgListRefData)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.activeUsers).toHaveLength(0)
    expect(categorisedUsers.inactiveUsers).toHaveLength(1)
    expect(categorisedUsers.inactiveUsers[0]).toEqual({
      active: false,
      id: emailAddress.toLowerCase(),
      importDate: previousImportDate,
      orgCode,
      phoneNumbers: []
    })
  })
})
