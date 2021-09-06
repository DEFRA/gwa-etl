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

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.activeUsers).toEqual([])
    expect(categorisedUsers.inactiveUsers).toEqual([])
  })

  test('existing users are marked inactive when not included in users to import', async () => {
    const usersToImport = []
    const existingUsers = [{}]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.activeUsers).toEqual([])
    expect(categorisedUsers.inactiveUsers.length).toEqual(1)
    expect(categorisedUsers.inactiveUsers).toEqual([{ active: false }])
  })

  test.each([
    { emailAddress: 'abc@domain.com', id: 'abc@domain.com' },
    { emailAddress: 'ABC@domain.com', id: 'abc@domain.com' }
  ])('existing users included in users to import are correctly mapped as existing users', async ({ emailAddress, id }) => {
    const usersToImport = [{ emailAddress }]
    const existingUsers = [{ id, phoneNumbers: [] }]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.inactiveUsers).toEqual([])
    const activeUsers = categorisedUsers.activeUsers
    expect(activeUsers.length).toEqual(1)
    expect(activeUsers[0]).not.toHaveProperty('emailAddress')
    expect(activeUsers[0]).toEqual({
      active: true,
      id,
      importDate: now,
      phoneNumbers: []
    })
  })

  test.each([
    { emailAddress: 'abc@domain.com', id: 'abc@domain.com' },
    { emailAddress: 'ABC@domain.com', id: 'abc@domain.com' }
  ])('existing users not included in users to import are correctly mapped as users created', async ({ emailAddress, id }) => {
    const usersToImport = [{ emailAddress }]
    const existingUsers = []

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    const activeUsers = categorisedUsers.activeUsers
    expect(activeUsers.length).toEqual(1)
    expect(activeUsers[0]).not.toHaveProperty('emailAddress')
    expect(activeUsers[0]).toEqual({
      active: true,
      id,
      importDate: now,
      phoneNumbers: []
    })
    expect(categorisedUsers.inactiveUsers).toEqual([])
  })
})
