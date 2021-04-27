const envVars = require('./test/testEnvVars')

process.env.AzureWebJobsStorage = envVars.AzureWebJobsStorage
process.env.AW_AUTH_HEADER = envVars.AW_AUTH_HEADER
process.env.AW_DOMAIN = envVars.AW_DOMAIN
process.env.AW_TENANT_CODE = envVars.AW_TENANT_CODE
process.env.DATA_EXTRACT_CONTAINER = envVars.DATA_EXTRACT_CONTAINER
process.env.DATA_SOURCES_CONTAINER = envVars.DATA_SOURCES_CONTAINER
