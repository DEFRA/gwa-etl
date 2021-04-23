const fetch = require('node-fetch')

const awAuthHeader = process.env.AW_AUTH_HEADER
const awDomain = process.env.AW_DOMAIN
const awTenantCode = process.env.AW_TENANT_CODE

module.exports = async function (context) {
  try {
    const users = new Map()
    const pageSize = 500 // default is 500 prefer to be specific
    let page = 0 // zero based
    let next = false
    let deviceCount = 0
    let noEmailCount = 0
    let noPhoneNumberCount = 0

    do {
      const url = `https://${awDomain}/API/mdm/devices/search?pagesize=${pageSize}&page=${page}`
      page++
      context.log(`Request URL: ${url}.`)
      const res = await fetch(url, {
        headers: {
          Authorization: awAuthHeader,
          'aw-tenant-code': awTenantCode,
          'Content-Type': 'application/json'
        }
      })

      const { Devices, Page, PageSize, Total } = (await res.json())
      const resDeviceCount = Devices.length
      context.log(`Response\nStatus: ${res.status} (${res.statusText})\nHeaders: ${JSON.stringify(res.headers.raw())}`)
      context.log(`DeviceCount: ${resDeviceCount}`)
      context.log(`Page: ${Page}\nPageSize: ${PageSize}\nTotal: ${Total}`)

      for (let i = 0; i < resDeviceCount; i++) {
        deviceCount++
        const device = Devices[i]
        const { PhoneNumber: phoneNumber, UserEmailAddress: emailAddress } = device

        if (emailAddress) {
          let user = users.get(emailAddress)
          if (phoneNumber) {
            if (user) {
              user.phoneNumbers.push(phoneNumber)
            } else {
              user = { emailAddress, phoneNumbers: [phoneNumber] }
            }
            users.set(emailAddress, user)
          } else {
            if (!user) {
              users.set(emailAddress, user = { emailAddress, phoneNumbers: [] })
            }
            noPhoneNumberCount++
          }
        } else {
          noEmailCount++
        }
      }
      context.log(`Processed ${deviceCount} devices.`)

      next = page * pageSize < Total
    } while (next)

    context.bindings.awUsers = [...users.values()]

    context.log(`Data extract from AW is complete.\n${deviceCount} devices have been processed.`)
    context.log(`${users.size} devices have a UserEmailAddress of which ${noPhoneNumberCount} have no PhoneNumber.`)
    context.log(`${noEmailCount} devices with no UserEmailAddress.`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
