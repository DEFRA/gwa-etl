const { generateUsersWithId } = require('../test/generateUsers')
const testEnvVars = require('../test/testEnvVars')

const outputBindingName = 'aadUsers'

describe('ExtractAADData function', () => {
  const context = require('../test/defaultContext')

  function expectInitialFetchRequestIsCorrect () {
    const $count = '$count=true'
    const $filter = '$filter=accountEnabled eq true and mail ne null'
    const $select = '$select=id,mail,givenName,surname,companyName,officeLocation'
    const url = `https://graph.microsoft.com/v1.0/users?${$select}&${$filter}&${$count}`
    expect(fetch).toHaveBeenCalledWith(url, {
      headers: {
        Authorization: `Bearer ${accessTokenValue}`,
        ConsistencyLevel: 'eventual',
        'Content-Type': 'application/json'
      }
    })
  }

  async function mockFetchResolvedJsonValueOnce (val) {
    fetch.mockResolvedValueOnce({ json: async () => { return val } })
  }

  let extractAADData
  let fetch
  let msal
  let acquireTokenMock
  const accessTokenValue = 'access-token'
  const defaultTokenScopes = { scopes: ['https://graph.microsoft.com/.default'] }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    fetch = require('node-fetch')
    jest.mock('node-fetch')
    msal = require('@azure/msal-node')
    jest.mock('@azure/msal-node')

    acquireTokenMock = jest.fn().mockResolvedValueOnce({ accessToken: accessTokenValue })

    msal.ConfidentialClientApplication.mockImplementation(() => {
      return { acquireTokenByClientCredential: acquireTokenMock }
    })

    extractAADData = require('.')
  })

  test('MSAL client is correctly created on module import', async () => {
    expect(msal.ConfidentialClientApplication).toHaveBeenCalledTimes(1)
    expect(msal.ConfidentialClientApplication).toHaveBeenCalledWith({
      auth: {
        authority: `https://login.microsoftonline.com/${testEnvVars.AAD_TENANT_ID}`,
        clientId: testEnvVars.AAD_CLIENT_ID,
        clientSecret: testEnvVars.AAD_CLIENT_SECRET
      }
    })
  })

  test('request to Graph API is made correctly for single page of results', async () => {
    const users = generateUsersWithId(1)
    const expectedResponse = { value: users }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAADData(context)

    expect(acquireTokenMock).toHaveBeenCalledTimes(1)
    expect(acquireTokenMock).toHaveBeenCalledWith(defaultTokenScopes)
    expect(fetch).toHaveBeenCalledTimes(1)
    expectInitialFetchRequestIsCorrect()
    expect(context.log).toHaveBeenCalledTimes(3)
    expect(context.log).toHaveBeenNthCalledWith(1, `Retrieved ${users.length} user(s).`)
    expect(context.log).toHaveBeenNthCalledWith(2, 'No nextLink available, processing complete.')
    expect(context.log).toHaveBeenNthCalledWith(3, `Data extract from AAD is complete.\n${users.length} user(s) have been processed.`)
  })

  test('request to Graph API is made correctly for several pages of results', async () => {
    const users = generateUsersWithId(101)
    const usersOne = users.slice(0, 100)
    const usersTwo = users.slice(100)
    const nextLink = 'https://next.page.of.results'
    const expectedResponseOne = { value: usersOne, '@odata.nextLink': nextLink }
    const expectedResponseTwo = { value: usersTwo }
    mockFetchResolvedJsonValueOnce(expectedResponseOne)
    mockFetchResolvedJsonValueOnce(expectedResponseTwo)

    await extractAADData(context)

    expect(acquireTokenMock).toHaveBeenCalledTimes(1)
    expect(acquireTokenMock).toHaveBeenCalledWith(defaultTokenScopes)
    expect(fetch).toHaveBeenCalledTimes(2)
    expectInitialFetchRequestIsCorrect()
    expect(fetch).toHaveBeenNthCalledWith(2, nextLink, {
      headers: {
        Authorization: `Bearer ${accessTokenValue}`,
        ConsistencyLevel: 'eventual',
        'Content-Type': 'application/json'
      }
    })
    expect(context.log).toHaveBeenCalledTimes(5)
    expect(context.log).toHaveBeenNthCalledWith(1, `Retrieved ${usersOne.length} user(s).`)
    expect(context.log).toHaveBeenNthCalledWith(2, 'A nextLink is available, processing will continue.')
    expect(context.log).toHaveBeenNthCalledWith(3, `Retrieved ${usersTwo.length} user(s).`)
    expect(context.log).toHaveBeenNthCalledWith(4, 'No nextLink available, processing complete.')
    expect(context.log).toHaveBeenNthCalledWith(5, `Data extract from AAD is complete.\n${users.length} user(s) have been processed.`)
  })

  test('user data is bound to correct output binding', async () => {
    const numberOfUsers = 100
    const users = generateUsersWithId(numberOfUsers)
    const expectedResponse = { value: JSON.parse(JSON.stringify(users)) }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAADData(context)

    expect(context.bindings).toHaveProperty(outputBindingName)
    expect(context.bindings[outputBindingName]).toHaveLength(numberOfUsers)
    context.bindings[outputBindingName].forEach((user, i) => {
      expect(user).not.toHaveProperty('mail')
      expect(user.id).toEqual(users[i].id)
      expect(user.emailAddress).toEqual(users[i].mail)
      expect(user.givenName).toEqual(users[i].givenName)
      expect(user.surname).toEqual(users[i].surname)
      expect(user.companyName).toEqual(users[i].companyName)
      expect(user.officeLocation).toEqual(users[i].officeLocation)
    })
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Return nothing to generate error. Dereferenced res values are undefined.
    fetch.mockResolvedValueOnce({ })

    await expect(extractAADData(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('ExtractAADData bindings', () => {
  const { bindings: functionBindings } = require('./function')

  test('output binding is correct', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'out')
    expect(bindings).toHaveLength(1)

    const binding = bindings[0]
    expect(binding.name).toEqual(outputBindingName)
    expect(binding.type).toEqual('blob')
    expect(binding.path).toEqual(`%${testEnvVars.DATA_EXTRACT_CONTAINER}%/aad-users.json`)
  })

  test('timer schedule runs at 09:00 every Sunday', () => {
    const bindings = functionBindings.filter((binding) => binding.direction === 'in')
    expect(bindings).toHaveLength(1)
    expect(bindings[0].schedule).toEqual('0 0 9 * * 0')
  })
})
