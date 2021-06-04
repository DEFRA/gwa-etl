const Joi = require('joi')

const schema = Joi.object({
  id: Joi.string().guid().required(),
  emailAddress: Joi.string().email().required(),
  officeCode: Joi.string().pattern(/^[A-Z]{3}:[a-zA-Z0-9-]+$/).required(),
  officeLocation: Joi.string().required(),
  orgCode: Joi.string().required(),
  orgName: Joi.string().required(),
  givenName: Joi.string().required(),
  surname: Joi.string().required(),
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
        errorUsers.push({ error })
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
