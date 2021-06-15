describe('getBlobContents', () => {
  const getBlobContents = require('./getBlobContents')

  const filename = 'unimportant-file-name'

  const { Readable } = require('stream').Stream

  function mockDownload (contents, encoding) {
    const mockReadable = new Readable({ read () {} })
    if (encoding) {
      mockReadable.setEncoding(encoding) // default is null
    }
    mockReadable.push(JSON.stringify(contents))
    mockReadable.push(null)
    return { readableStreamBody: mockReadable }
  }

  function mockClientWithDownload (fileContents, encoding) {
    return {
      getBlobClient: jest.fn(() => {
        return {
          download: jest.fn().mockResolvedValue(mockDownload(fileContents, encoding)),
          exists: () => { return true }
        }
      })
    }
  }

  test('when no file exists, null is returned', async () => {
    const client = {
      getBlobClient: jest.fn(() => {
        return { exists: () => { return false } }
      })
    }

    const blobContents = await getBlobContents(client, filename)

    expect(blobContents).toBeUndefined()
    expect(client.getBlobClient).toHaveBeenCalledTimes(1)
    expect(client.getBlobClient).toHaveBeenCalledWith(filename)
  })

  test('when file exists, the file is downloaded', async () => {
    const fileContents = [{ emailAddress: 'a@a.com' }]
    const client = mockClientWithDownload(fileContents)

    const blobContents = await getBlobContents(client, filename)

    expect(blobContents).toEqual(fileContents)
    expect(client.getBlobClient).toHaveBeenCalledTimes(1)
    expect(client.getBlobClient).toHaveBeenCalledWith(filename)
  })

  test('when file exists, the file is downloaded with utf8 encoding', async () => {
    const fileContents = [{ emailAddress: 'a@a.com' }]
    const client = mockClientWithDownload(fileContents, 'utf8')

    const blobContents = await getBlobContents(client, filename)

    expect(blobContents).toEqual(fileContents)
    expect(client.getBlobClient).toHaveBeenCalledTimes(1)
    expect(client.getBlobClient).toHaveBeenCalledWith(filename)
  })
})
