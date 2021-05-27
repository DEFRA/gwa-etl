const fetch = require('node-fetch')
const msal = require('@azure/msal-node')
const { CosmosClient } = require('@azure/cosmos')

const clientId = process.env.AAD_CLIENT_ID
const clientSecret = process.env.AAD_CLIENT_SECRET
const tenantId = process.env.AAD_TENANT_ID
const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const refDataContainerName = process.env.COSMOS_DB_REFDATA_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const refDataContainer = db.container(refDataContainerName)
const officeLocationMapDocumentId = 'standardisedOfficeLocationMap'
const unmappedOfficeCode = 'UNM:Unmapped'

const cca = new msal.ConfidentialClientApplication({
  auth: {
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientId,
    clientSecret
  }
})

module.exports = async function (context) {
  try {
    const refData = (await refDataContainer.item(officeLocationMapDocumentId, officeLocationMapDocumentId).read())?.resource
    if (!refData) {
      throw new Error(`No reference data retrieved for ${officeLocationMapDocumentId}.`)
    }
    const officeLocationMap = new Map(refData.data.map(ol => [ol.originalOfficeLocation, { officeCode: ol.officeCode, officeLocation: ol.officeLocation }]))

    const clientCredentialRequest = { scopes: ['https://graph.microsoft.com/.default'] }
    const authResult = await cca.acquireTokenByClientCredential(clientCredentialRequest)
    const accessToken = authResult.accessToken

    let processedUsers = []

    const count = '$count=true'
    const filter = '$filter=accountEnabled eq true and mail ne null'
    const select = '$select=id,mail,givenName,surname,companyName,officeLocation'
    let url = `https://graph.microsoft.com/v1.0/users?${select}&${filter}&${count}`

    do {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ConsistencyLevel: 'eventual',
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      const users = data.value
      users.forEach(user => {
        user.emailAddress = user.mail.toLowerCase()
        delete user.mail
        const office = officeLocationMap.get(user.officeLocation)
        user.officeLocation = office?.officeLocation ?? unmappedOfficeCode.slice(4)
        user.officeCode = office?.officeCode ?? unmappedOfficeCode
      })
      processedUsers = processedUsers.concat(users)
      url = data['@odata.nextLink']

      context.log(`Retrieved ${users.length} user(s).`)
      context.log(`${url ? 'A nextLink is available, processing will continue.' : 'No nextLink available, processing complete.'}`)
    } while (url)

    context.bindings.aadUsers = processedUsers

    context.log(`Data extract from AAD is complete.\n${processedUsers.length} user(s) have been processed.`)
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
