const fs = require('fs')
const path = require('path')
const { BlobSASPermissions, BlockBlobClient } = require('@azure/storage-blob')
const archiver = require('archiver')
const archiverZipEncrypt = require('archiver-zip-encrypted')
const { NotifyClient } = require('notifications-node-client')
const { zipFilename } = require('../lib/config')

archiver.registerFormat('zip-encrypted', archiverZipEncrypt)

const emailAddress = process.env.PHONE_NUMBERS_EMAIL_ADDRESS
const notifyClientApiKey = process.env.NOTIFY_CLIENT_API_KEY
const notifyTemplateId = process.env.NOTIFY_TEMPLATE_ID
const notifyClient = new NotifyClient(notifyClientApiKey)

const connectionString = process.env.AzureWebJobsStorage
const phoneNumbersContainer = process.env.PHONE_NUMBERS_CONTAINER
const filename = process.env.PHONE_NUMBERS_FILE
const password = process.env.PHONE_NUMBERS_ZIP_PASSWORD
const blockBlobClient = new BlockBlobClient(connectionString, phoneNumbersContainer, zipFilename)

// HOME contains a writable path in Azure Functions
const homePath = process.env.HOME
const zipPath = path.join(homePath, zipFilename)

async function uploadFile (context) {
  await blockBlobClient.uploadFile(zipPath, { blobHTTPHeaders: { blobContentType: 'application/zip' } })
  context.log(`Uploaded file: ${zipFilename} to container: ${phoneNumbersContainer}.`)
}

async function getSasUrl (context) {
  const expiresOn = new Date(Date.now())
  expiresOn.setDate(expiresOn.getDate() + 29)
  const sasUrl = await blockBlobClient.generateSasUrl({
    expiresOn,
    permissions: BlobSASPermissions.parse('r')
  })
  context.log(`Generated sasUrl: ${sasUrl}.`)
  return sasUrl
}

async function sendEmail (context, linkToFile) {
  await notifyClient.sendEmail(notifyTemplateId, emailAddress, {
    personalisation: {
      linkToFile
    }
  })
  context.log(`Sent email to: ${emailAddress}.`)
}

async function zipFile (output, blobContents, reject) {
  try {
    const archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password })

    archive.append(blobContents, { name: filename })
    archive.pipe(output)
    await archive.finalize()
  } catch (e) {
    reject(e)
  }
}

module.exports = async context => {
  try {
    const { blobContents } = context.bindings

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      output.on('close', async () => {
        try {
          await uploadFile(context)
          const sasUrl = await getSasUrl(context)
          await sendEmail(context, sasUrl)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      output.on('error', err => {
        reject(err)
      })

      return zipFile(output, blobContents, reject)
    })
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
