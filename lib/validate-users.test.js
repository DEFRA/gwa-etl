const validateUsers = require('./validate-users')

describe('Validating users', () => {
  const validInput = {
    emailAddress: 'a@a.com',
    orgCode: 'ORGCODE',
    orgName: 'A well formatted name',
    officeCode: 'VLD:validOfficeLocation-1-99',
    officeLocation: 'a valid office location',
    givenName: 'givenName',
    surname: 'surname',
    phoneNumbers: []
  }

  test.each([
    ['phoneNumbers', []],
    ['phoneNumbers', ['+447100111111']],
    ['phoneNumbers', ['+447100111111', '+447100222222']]
  ])('users are saved to valid users output binding when they are valid input', (property, value) => {
    validInput[property] = value
    const users = [validInput]

    const { errorUsers, validUsers } = validateUsers(users)

    expect(validUsers).toHaveLength(1)
    expect(validUsers).toEqual(users)
    expect(errorUsers).toHaveLength(0)
  })

  test.each([
    ['emailAddress'],
    ['officeCode'],
    ['officeLocation'],
    ['orgCode'],
    ['orgName'],
    ['givenName'],
    ['surname'],
    ['phoneNumbers']
  ])('users are saved to error users output binding when they are not valid input - missing property (%s)', (property) => {
    const input = { ...validInput }
    delete input[property]
    const users = [input]

    const { errorUsers, validUsers } = validateUsers(users)

    expect(errorUsers).toHaveLength(1)
    expect(errorUsers[0].error._original).toEqual(users[0])
    expect(validUsers).toHaveLength(0)
  })

  test.each([
    ['emailAddress', undefined],
    ['emailAddress', 'not-an-email'],
    ['officeCode', undefined],
    ['officeCode', 'WRONG:format'],
    ['officeLocation', undefined],
    ['orgCode', undefined],
    ['orgName', undefined],
    ['givenName', undefined],
    ['surname', undefined],
    ['phoneNumbers', undefined],
    ['phoneNumbers', ['07000111111']]
  ])('users are saved to error users output binding when they are not valid input - incorrect format property (%s)', (property, value) => {
    const input = { ...validInput }
    input[property] = value
    const users = [input]

    const { errorUsers, validUsers } = validateUsers(users)

    expect(errorUsers).toHaveLength(1)
    expect(errorUsers[0].error._original).toEqual(users[0])
    expect(validUsers).toHaveLength(0)
  })
})
