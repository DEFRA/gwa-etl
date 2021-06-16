const { internalUsersFilename } = require('./config')

describe('Get Container Contents', () => {
  let getBlobContents
  let getContainerContents

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    jest.mock('./get-blob-contents')
    getBlobContents = require('./get-blob-contents')
    getContainerContents = require('./get-container-contents')
  })

  test('when no blobs exist, get blob contents is called only once for the internal users file', async () => {
    const internalFileContents = 'internal-file-contents'
    getBlobContents.mockResolvedValue(internalFileContents)
    async function * listBlobsFlatIterable () { }
    const containerClientMock = { listBlobsFlat: listBlobsFlatIterable }

    const containerContents = await getContainerContents(containerClientMock)

    expect(containerContents).toHaveLength(1)
    expect(containerContents[0]).toEqual(internalFileContents)
    expect(getBlobContents).toHaveBeenCalledTimes(1)
    expect(getBlobContents).toHaveBeenCalledWith(containerClientMock, internalUsersFilename)
  })

  test('when blobs exist, get blob contents is called for each blob in addition to the internal users file', async () => {
    const internalFileContents = 'internal-file-contents'
    const anotherBlobContents = 'blobContents'
    getBlobContents.mockResolvedValueOnce(internalFileContents).mockResolvedValueOnce(anotherBlobContents)
    const anotherFileName = 'another-filename.json'
    async function * listBlobsFlatIterable () {
      yield { name: internalUsersFilename }
      yield { name: anotherFileName }
    }
    const containerClientMock = { listBlobsFlat: listBlobsFlatIterable }

    const containerContents = await getContainerContents(containerClientMock)

    expect(containerContents).toHaveLength(2)
    expect(containerContents[0]).toEqual(internalFileContents)
    expect(containerContents[1]).toEqual(anotherBlobContents)
    expect(getBlobContents).toHaveBeenCalledTimes(2)
    expect(getBlobContents).toHaveBeenNthCalledWith(1, containerClientMock, internalUsersFilename)
    expect(getBlobContents).toHaveBeenNthCalledWith(2, containerClientMock, anotherFileName)
  })
})
