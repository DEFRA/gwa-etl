module.exports = async function (context) {
  try {
    const { blobContents } = context.bindings
    const users = JSON.parse(blobContents)

    // TODO: how to set all documents active=false prior to import? Do in code here? create a SPROC?
    const now = Date.now()
    users.forEach(user => {
      user.active = true
      user.id = user.emailAddress
      user.importDate = now
      delete user.emailAddress
    })

    context.bindings.users = users
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
