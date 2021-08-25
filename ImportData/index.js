const { CosmosClient } = require('@azure/cosmos')
const { NotifyClient } = require('notifications-node-client')

const categoriseUsers = require('../lib/categorise-users')
const generateReport = require('../lib/generate-report')
const getActivePhoneNumbers = require('../lib/get-active-phone-numbers')
const upsertUsers = require('../lib/upsert-users')

const emailAddress = process.env.NOTIFY_SEND_TO_EMAIL_ADDRESS
const importReportTemplateId = process.env.NOTIFY_TEMPLATE_ID_DATA_IMPORT_REPORT
const notifyClientApiKey = process.env.NOTIFY_CLIENT_API_KEY

const notifyClient = new NotifyClient(notifyClientApiKey)

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING
const dbName = process.env.COSMOS_DB_NAME
const usersContainerName = process.env.COSMOS_DB_USERS_CONTAINER

const client = new CosmosClient(connectionString)
const db = client.database(dbName)
const usersContainer = db.container(usersContainerName)

function getUsersToImport (context) {
  const { blobContents } = context.bindings
  return JSON.parse(blobContents)
}

async function getExistingUsers (container) {
  return (await container.items.query('SELECT * FROM c').fetchAll()).resources
}

async function sendEmail (context, content) {
  await notifyClient.sendEmail(importReportTemplateId, emailAddress, {
    personalisation: { content }
  })
  context.log(`Sent email to: ${emailAddress}.`)
}

function savePhoneNumbersFile (context, users) {
  const header = 'phone number'
  context.bindings.phoneNumbers = `${header}\n${getActivePhoneNumbers(users).join('\n')}`
}

module.exports = async context => {
  let emailContent

  try {
    try {
      const usersToImport = getUsersToImport(context)

      if (!usersToImport.length) {
        context.log.warn('No users to import, returning early.')
        emailContent = 'There were no users to import.'
        return
      }
      context.log(`Users to import: ${usersToImport.length}.`)

      const existingUsers = await getExistingUsers(usersContainer)
      context.log(`Users already existing: ${existingUsers.length}.`)

      const users = categoriseUsers(usersToImport, existingUsers)

      savePhoneNumbersFile(context, users)
      await upsertUsers(context, usersContainer, users)
      emailContent = generateReport(users)
    } catch (e) {
      emailContent = 'Import failed. Message: ' + e.message
      throw new Error(e)
    } finally {
      await sendEmail(context, emailContent)
    }
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
