const envVars = require('./test/testEnvVars')

process.env.AzureWebJobsStorage = envVars.AzureWebJobsStorage
process.env.AW_AUTH_HEADER = envVars.AW_AUTH_HEADER
process.env.AW_DOMAIN = envVars.AW_DOMAIN
process.env.AW_TENANT_CODE = envVars.AW_TENANT_CODE