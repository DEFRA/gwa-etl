const Joi = require('joi')

const schema = Joi.object({
  companyName: Joi.string().required(),
  officeLocation: Joi.string().required(),
  emailAddress: Joi.string().email().required(),
  surname: Joi.string().required(),
  givenName: Joi.string().required(),
  phoneNumbers: Joi.array().required()
})

module.exports = async function (context) {
  try {
    // Copy file contents
    const { blobContents } = context.bindings

    const users = JSON.parse(blobContents)

    const errors = []

    users.forEach(user => {
      const { error } = schema.validate(user)
      if (error) {
        errors.push({ error, user })
      }
    })

    if (errors.length > 0) {
      context.log.error(`Validation failures: ${errors}.`)
      throw new Error('Validation failed')
    }

    context.bindings.users = users
  } catch (e) {
    context.log.error(e)
    // Throwing an error ensures the built-in retry will kick in
    throw new Error(e)
  }
}
