const userSchema = require('../lib/user-schema')

module.exports = (users) => {
  const errorUsers = []
  const validUsers = users.filter(user => {
    const { error } = userSchema.validate(user)
    if (error) {
      errorUsers.push({ error })
      return false
    }
    return true
  })
  return {
    errorUsers,
    validUsers
  }
}
