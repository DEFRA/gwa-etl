const fs = require('fs')
const path = require('path')
const { BlobSASPermissions, BlockBlobClient } = require('@azure/storage-blob')
const archiver = require('archiver')
const archiverZipEncrypt = require('archiver-zip-encrypted')
const { NotifyClient } = require('notifications-node-client')

archiver.registerFormat('zip-encrypted', archiverZipEncrypt)

const emailAddress = process.env.PHONE_NUMBERS_EMAIL_ADDRESS
const notifyClientApiKey = process.env.NOTIFY_CLIENT_API_KEY
const notifyTemplateId = process.env.NOTIFY_TEMPLATE_ID
const notifyClient = new NotifyClient(notifyClientApiKey)

const connectionString = process.env.AzureWebJobsStorage
const phoneNumbersContainer = process.env.PHONE_NUMBERS_CONTAINER
const filename = process.env.PHONE_NUMBERS_FILE
const password = process.env.PHONE_NUMBERS_ZIP_PASSWORD
const zipFilename = 'phone-numbers.zip'
const bbclient = new BlockBlobClient(connectionString, phoneNumbersContainer, zipFilename)

const zipPath = path.join(__dirname, zipFilename)

async function uploadFile (context) {
  await bbclient.uploadFile(zipPath, { blobHTTPHeaders: { blobContentType: 'application/zip' } })
  context.log(`Uploaded file: ${zipFilename} to container: ${phoneNumbersContainer}.`)
}

async function getSasUrl (context) {
  const expiresOn = new Date()
  expiresOn.setDate(expiresOn.getDate() + 29)
  const sasUrl = await bbclient.generateSasUrl({
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

async function zipFile (context, output, blobContents) {
  const archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password })

  archive.on('error', err => context.log.error(err))
  archive.on('warning', msg => context.log.warn(msg))

  archive.append(blobContents, { name: filename })
  archive.pipe(output)
  await archive.finalize()
}

module.exports = async context => {
  const { blobContents } = context.bindings

  try {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      output.on('close', async () => {
        await uploadFile(context)
        const sasUrl = await getSasUrl(context)
        await sendEmail(context, sasUrl)
        resolve('resolved')
      })
      output.on('error', err => {
        context.log(err)
        reject(err)
      })

      zipFile(context, output, blobContents)
    })
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}