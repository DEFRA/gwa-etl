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
    expect(categorisedUsers).toHaveProperty('usersCreated')
    expect(categorisedUsers).toHaveProperty('usersInactive')
    expect(categorisedUsers).toHaveProperty('usersUpdated')
  }

  test('empty arrays are returned when no users to import', async () => {
    const usersToImport = []
    const existingUsers = []

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.usersCreated).toEqual([])
    expect(categorisedUsers.usersInactive).toEqual([])
    expect(categorisedUsers.usersUpdated).toEqual([])
  })

  test('existing users are marked inactive when not included in users to import', async () => {
    const usersToImport = []
    const existingUsers = [{}]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.usersCreated).toEqual([])
    expect(categorisedUsers.usersInactive.length).toEqual(1)
    expect(categorisedUsers.usersInactive).toEqual([{ active: false }])
    expect(categorisedUsers.usersUpdated).toEqual([])
  })

  test.each([
    { emailAddress: 'abc@domain.com', id: 'abc@domain.com' },
    { emailAddress: 'ABC@domain.com', id: 'abc@domain.com' }
  ])('existing users included in users to import are correctly mapped as existing users', async ({ emailAddress, id }) => {
    const usersToImport = [{ emailAddress }]
    const existingUsers = [{ id, phoneNumbers: [] }]

    const categorisedUsers = await categoriseUsers(usersToImport, existingUsers)

    expectPropertiesToExist(categorisedUsers)
    expect(categorisedUsers.usersCreated).toEqual([])
    expect(categorisedUsers.usersInactive).toEqual([])
    const usersUpdated = categorisedUsers.usersUpdated
    expect(usersUpdated.length).toEqual(1)
    expect(usersUpdated[0]).not.toHaveProperty('emailAddress')
    expect(usersUpdated[0]).toEqual({
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
    const usersCreated = categorisedUsers.usersCreated
    expect(usersCreated.length).toEqual(1)
    expect(usersCreated[0]).not.toHaveProperty('emailAddress')
    expect(usersCreated[0]).toEqual({
      active: true,
      id,
      importDate: now,
      phoneNumbers: []
    })
    expect(categorisedUsers.usersInactive).toEqual([])
    expect(categorisedUsers.usersUpdated).toEqual([])
  })
})
