const { ContainerClient } = require('@azure/storage-blob')

const combineData = require('../lib/combineData')
const getBlobContents = require('../lib/getBlobContents')
const { aadFilename, awFilename } = require('../lib/config')

const connectionString = process.env.AzureWebJobsStorage
const dataExtractContainer = process.env.DATA_EXTRACT_CONTAINER

const containerClient = new ContainerClient(connectionString, dataExtractContainer)

module.exports = async function (context) {
  try {
    const { triggerFilename } = context.bindingData
    const { triggerFileContents } = context.bindings

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
      const combinedData = combineData(triggerFileContents, retrievedFileContents)
      context.bindings.internalUsers = combinedData
      context.log('Data has been combined.')
    } else {
      context.log.warn(`'${retrieveFilename}' not found, no data will be combined.`)
    }
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
