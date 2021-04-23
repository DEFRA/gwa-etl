const fetch = require('node-fetch')
const extractAWData = require('./index')
const functionDef = require('./function')

const context = require('../test/defaultContext')
const generateDevices = require('../test/generateDevices')
const testEnvVars = require('../test/testEnvVars')

jest.mock('node-fetch')

function expectFetchRequestIsCorrect (url) {
  expect(fetch).toHaveBeenCalledWith(url, {
    headers: {
      Authorization: testEnvVars.AW_AUTH_HEADER,
      'aw-tenant-code': testEnvVars.AW_TENANT_CODE,
      'Content-Type': 'application/json'
    }
  })
}

const expectedOutputBindingName = 'awUsers'
const statusText = 'OK'
const status = 200

async function mockFetchResolvedJsonValueOnce (val) {
  fetch.mockResolvedValueOnce({
    headers: { raw: () => { return {} } },
    json: async () => { return val },
    status,
    statusText
  })
}

describe('ExtractAWData function', () => {
  const PageSize = 500

  afterEach(() => { jest.clearAllMocks() })

  test('request to AW API is made correctly', async () => {
    const expectedResponse = { Devices: [], Page: 0, PageSize, Total: 0 }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAWData(context)

    expect(fetch).toHaveBeenCalledTimes(1)
    expectFetchRequestIsCorrect(`https://${testEnvVars.AW_DOMAIN}/API/mdm/devices/search?pagesize=${PageSize}&page=0`)
  })

  test('multiple pages are retrieved to cover all devices', async () => {
    const expectedResponse1 = { Devices: [], Page: 0, PageSize, Total: 501 }
    const expectedResponse2 = { Devices: [], Page: 1, PageSize, Total: 501 }
    mockFetchResolvedJsonValueOnce(expectedResponse1)
    mockFetchResolvedJsonValueOnce(expectedResponse2)

    await extractAWData(context)

    expect(fetch).toHaveBeenCalledTimes(2)
    expectFetchRequestIsCorrect(`https://${testEnvVars.AW_DOMAIN}/API/mdm/devices/search?pagesize=${PageSize}&page=0`)
    expectFetchRequestIsCorrect(`https://${testEnvVars.AW_DOMAIN}/API/mdm/devices/search?pagesize=${PageSize}&page=1`)
  })

  test('user data is bound to correct output binding', async () => {
    const numberOfDevices = 1
    const Devices = generateDevices(numberOfDevices)
    const expectedResponse = { Devices, Page: 0, PageSize, Total: 0 }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAWData(context)

    expect(context.bindings).toHaveProperty(expectedOutputBindingName)
    expect(context.bindings[expectedOutputBindingName]).toHaveLength(numberOfDevices)
    const device = context.bindings[expectedOutputBindingName][0]
    expect(device.emailAddress).toEqual(Devices[0].UserEmailAddress)
    expect(device.phoneNumbers[0]).toEqual(Devices[0].PhoneNumber)
  })

  test('user data is only added when user has a UserEmailAddress', async () => {
    const Devices = generateDevices(3)
    delete Devices[1].UserEmailAddress
    delete Devices[2].PhoneNumber
    const expectedResponse = { Devices, Page: 0, PageSize, Total: 0 }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAWData(context)

    expect(context.bindings).toHaveProperty(expectedOutputBindingName)
    expect(context.bindings[expectedOutputBindingName]).toHaveLength(2)
    const user1 = context.bindings[expectedOutputBindingName][0]
    expect(user1.emailAddress).toEqual(Devices[0].UserEmailAddress)
    expect(user1.phoneNumbers[0]).toEqual(Devices[0].PhoneNumber)
    const user2 = context.bindings[expectedOutputBindingName][1]
    expect(user2.emailAddress).toEqual(Devices[2].UserEmailAddress)
    expect(user2.phoneNumbers[0]).toEqual(undefined)
  })

  test('users with multiple devices have a single record with all phone numbers included', async () => {
    const Devices = generateDevices(4)
    Devices[2].UserEmailAddress = Devices[0].UserEmailAddress
    Devices[3].UserEmailAddress = Devices[1].UserEmailAddress
    Devices[3].PhoneNumber = ''
    const expectedResponse = { Devices, Page: 0, PageSize, Total: 0 }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAWData(context)

    expect(context.bindings[expectedOutputBindingName]).toHaveLength(2)
    const user1 = context.bindings[expectedOutputBindingName][0]
    expect(user1.emailAddress).toEqual(Devices[0].UserEmailAddress)
    expect(user1.phoneNumbers).toHaveLength(2)
    expect(user1.phoneNumbers[0]).toEqual(Devices[0].PhoneNumber)
    expect(user1.phoneNumbers[1]).toEqual(Devices[2].PhoneNumber)
    const user2 = context.bindings[expectedOutputBindingName][1]
    expect(user2.emailAddress).toEqual(Devices[1].UserEmailAddress)
    expect(user2.phoneNumbers).toHaveLength(1)
    expect(user2.phoneNumbers[0]).toEqual(Devices[1].PhoneNumber)
  })

  test('logging during processing is correct', async () => {
    const deviceCount = 3
    const Total = deviceCount
    const Devices = generateDevices(deviceCount)
    delete Devices[1].UserEmailAddress
    delete Devices[2].PhoneNumber
    const expectedResponse = { Devices, Page: 0, PageSize, Total }
    mockFetchResolvedJsonValueOnce(expectedResponse)

    await extractAWData(context)

    expect(context.log).toHaveBeenCalledTimes(8)
    expect(context.log).toHaveBeenNthCalledWith(1, `Request URL: https://${testEnvVars.AW_DOMAIN}/API/mdm/devices/search?pagesize=${PageSize}&page=0.`)
    expect(context.log).toHaveBeenNthCalledWith(2, `Response\nStatus: ${status} (${statusText})\nHeaders: {}`)
    expect(context.log).toHaveBeenNthCalledWith(3, `DeviceCount: ${deviceCount}`)
    expect(context.log).toHaveBeenNthCalledWith(4, `Page: ${0}\nPageSize: ${PageSize}\nTotal: ${Total}`)
    expect(context.log).toHaveBeenNthCalledWith(5, `Processed ${deviceCount} devices.`)
    expect(context.log).toHaveBeenNthCalledWith(6, `Data extract from AW is complete.\n${deviceCount} devices have been processed.`)
    expect(context.log).toHaveBeenNthCalledWith(7, `${2} devices have a UserEmailAddress of which ${1} have no PhoneNumber.`)
    expect(context.log).toHaveBeenNthCalledWith(8, `${1} devices with no UserEmailAddress.`)
  })

  test('an error is thrown (and logged) when an error occurs', async () => {
    // Return nothing to generate error. Dereferenced res values are undefined.
    fetch.mockResolvedValueOnce({ })

    await expect(extractAWData(context)).rejects.toThrow(Error)

    expect(context.log.error).toHaveBeenCalledTimes(1)
  })
})

describe('ExtractAWData bindings', () => {
  test('output binding is correct', () => {
    const outputBindings = functionDef.bindings.filter((binding) => binding.direction === 'out')
    expect(outputBindings).toHaveLength(1)

    const outputBinding = outputBindings[0]
    expect(outputBinding.name).toEqual(expectedOutputBindingName)
    expect(outputBinding.type).toEqual('blob')
    expect(outputBinding.path).toEqual(`%${testEnvVars.AW_EXTRACT_CONTAINER}%/aw-users.json`)
  })

  test('timer schedule is set correctly', () => {
    const inputBindings = functionDef.bindings.filter((binding) => binding.direction === 'in')
    expect(inputBindings).toHaveLength(1)
    expect(inputBindings[0].schedule).toEqual('0 0 8 * * 5')
  })
})
