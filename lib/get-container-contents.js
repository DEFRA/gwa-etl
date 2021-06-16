const { internalUsersFilename } = require('../lib/config')
const getBlobContents = require('../lib/get-blob-contents')

module.exports = async (containerClient) => {
  const promises = []
  promises.push(getBlobContents(containerClient, internalUsersFilename))
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name !== internalUsersFilename) {
      promises.push(getBlobContents(containerClient, blob.name))
    }
  }
  return Promise.all(promises)
}
