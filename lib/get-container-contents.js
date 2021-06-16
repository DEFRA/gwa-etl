const { internalUsersFilename } = require('../lib/config')
const getBlobContents = require('../lib/get-blob-contents')

/**
 * Get the contents of all files in the container.
 *
 * @param {ContainerClient} container to retrieve files in.
 * @returns {Promise} representing the contents of all files in JSON from the
 * container. The first element is always content from `internal-users.json`,
 * if there is no such file `undefined` is returned.
 */
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
