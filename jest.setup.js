const envVars = require('./test/testEnvVars')

process.env.AzureWebJobsStorage = envVars.AzureWebJobsStorage
process.env.AW_AUTH_HEADER = envVars.AW_AUTH_HEADER
process.env.AW_DOMAIN = envVars.AW_DOMAIN
process.env.AW_TENANT_CODE = envVars.AW_TENANT_CODE
process.env.COSMOS_DB_CONNECTION_STRING = envVars.COSMOS_DB_CONNECTION_STRING
process.env.COSMOS_DB_NAME = envVars.COSMOS_DB_NAME
process.env.COSMOS_DB_USERS_CONTAINER = envVars.COSMOS_DB_USERS_CONTAINER
process.env.DATA_EXTRACT_CONTAINER = envVars.DATA_EXTRACT_CONTAINER
process.env.DATA_IMPORT_CONTAINER = envVars.DATA_IMPORT_CONTAINER
process.env.DATA_SOURCES_CONTAINER = envVars.DATA_SOURCES_CONTAINER
