module.exports = async function (context) {
  try {
    // Copy file contents
    const { internalUsersFileContents } = context.bindings

    context.bindings.users = internalUsersFileContents
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
