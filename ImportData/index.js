module.exports = async function (context) {
  try {
    const { blobContents } = context.bindings
    const users = JSON.parse(blobContents)

    users.forEach(user => {
      user.id = user.emailAddress
      delete user.emailAddress
    })

    context.bindings.users = users
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
