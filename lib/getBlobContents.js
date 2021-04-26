async function streamToBuffer (readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readableStream.on('data', data => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data))
    })
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    readableStream.on('error', reject)
  })
}

module.exports = async (containerClient, filename) => {
  const blobClient = containerClient.getBlobClient(filename)

  if (await blobClient.exists()) {
    const downloadBlobResponse = await blobClient.download()
    return (await streamToBuffer(downloadBlobResponse.readableStreamBody)).toString()
  } else {
    return null
  }
}
