module.exports = async function (context) {
  try {
    // Copy file contents
    const { blobContents } = context.bindings
    const users = JSON.parse(blobContents)

    // TODO: set email to be id
    context.bindings.users = users
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
