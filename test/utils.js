const fs = require('fs/promises')

async function exists (path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function removeFile (path) {
  try {
    await fs.unlink(path)
  } catch {
    // ignore error
  }
}

module.exports = {
  exists,
  removeFile
}
