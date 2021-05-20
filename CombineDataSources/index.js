const Joi = require('joi')

const schema = Joi.object({
  id: Joi.string().guid().required(),
  companyName: Joi.string().required(),
  officeLocation: Joi.string().required(),
  emailAddress: Joi.string().email().required(),
  surname: Joi.string().required(),
  givenName: Joi.string().required(),
  phoneNumbers: Joi.array().required()
})

module.exports = async function (context) {
  try {
    const { blobContents } = context.bindings

    const users = JSON.parse(blobContents)

    const errorUsers = []
    const validUsers = users.filter(user => {
      const { error } = schema.validate(user)
      if (error) {
        errorUsers.push({ error, user })
        return false
      }
      return true
    })

    context.bindings.validUsers = validUsers
    context.bindings.errorUsers = errorUsers
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
