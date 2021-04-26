const { ContainerClient } = require('@azure/storage-blob')

const getBlobContents = require('../lib/getBlobContents')

const connectionString = process.env.AzureWebJobsStorage
const dataExtractContainer = process.env.DATA_EXTRACT_CONTAINER

const containerClient = new ContainerClient(connectionString, dataExtractContainer)

const awFilename = 'aw-users.json'
const aadFilename = 'aad-users.json'

module.exports = async function (context) {
  try {
    const { triggerFilename } = context.bindingData
    const { triggerFileContents } = context.bindings
    context.log('triggerFileContents:', triggerFileContents) // TODO: delete

    let retrieveFilename
    switch (triggerFilename) {
      case awFilename:
        retrieveFilename = aadFilename
        break
      case aadFilename:
        retrieveFilename = awFilename
        break
      default:
        context.log.warn(`Unrecogonised file: '${triggerFilename}', no processing will take place.`)
        return
    }

    context.log(`Triggered on '${triggerFilename}', attempting to retrieve '${retrieveFilename}.`)
    const retrievedFileContents = await getBlobContents(containerClient, retrieveFilename)

    if (retrievedFileContents) {
      // TODO: check blobContents contains something
      // TODO: combine the two datasets
      context.log(`Blob contents for '${retrieveFilename}': ${retrievedFileContents}.`)
    } else {
      context.log.warn(`'${retrieveFilename}' not found, no data will be combined.`)
    }
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
