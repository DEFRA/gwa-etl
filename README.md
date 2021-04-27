# GWA ETL

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![tested with jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://github.com/facebook/jest)\
[![Build and Deploy Production](https://github.com/DEFRA/gwa-etl/actions/workflows/build-and-deploy-production.yml/badge.svg)](https://github.com/DEFRA/gwa-etl/actions/workflows/build-and-deploy-production.yml)
[![Build and Deploy Staging](https://github.com/DEFRA/gwa-etl/actions/workflows/build-and-deploy-staging.yml/badge.svg)](https://github.com/DEFRA/gwa-etl/actions/workflows/build-and-deploy-staging.yml)\
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gwa-etl&metric=coverage)](https://sonarcloud.io/dashboard?id=DEFRA_gwa-etl)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gwa-etl&metric=sqale_index)](https://sonarcloud.io/dashboard?id=DEFRA_gwa-etl)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gwa-etl&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=DEFRA_gwa-etl)\
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gwa-etl&metric=security_rating)](https://sonarcloud.io/dashboard?id=DEFRA_gwa-etl)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gwa-etl&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=DEFRA_gwa-etl)
[![Known Vulnerabilities](https://snyk.io/test/github/defra/gwa-etl/badge.svg)](https://snyk.io/test/github/defra/gwa-etl)

> An [Azure Function app](https://azure.microsoft.com/en-gb/services/functions/)
> for loading various sources of user data into Cosmos DB.

The app extracts data from
[AirWatch](https://www.vmware.com/products/workspace-one.html) before combining
it with data from
[Azure Active Directory](https://azure.microsoft.com/en-gb/services/active-directory/)
(the data could be from anywhere as long as the format was 'correct'). The
combined data is then imported it into Cosmos DB.

## Functions

The app is made up of a number of functions, each function is explained in more
detail in its' own README:

* [ExtractAWData](ExtractAWData/README.md)
* [CombineUserData](CombineUserData/README.md)
* [CombineDataSources](CombineDataSources/README.md)
* [ImportData](ImportData/README.md)

## Development

The best place to start for an overall view of how JavaScript Functions work in
Azure is the
[Azure Functions JavaScript developer guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=v2).
From there follow the appropriate link to the documentation specific to
your preferred development environment i.e.
[Visual Studio Code](https://docs.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-node)
or
[command line](https://docs.microsoft.com/en-us/azure/azure-functions/create-first-function-cli-node?tabs=azure-cli%2Cbrowser).

The documentation within this repo assumes the `command line` setup has been
completed, specifically for
[Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).

## Running Locally

To start the function app run `func start` or `npm run start` (which just runs
`func start`).

### Pre-requisites

The app uses Azure Storage blobs. When working locally
[Azurite](https://github.com/Azure/Azurite) can be used to emulate storage.
Follow the
[instructions](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azurite)
for your preferred installation option.

The app uses Cosmos DB. Whilst an emulator can be
[installed locally](https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator?tabs=cli%2Cssl-netstd21)
the effort involved is significant in comparison to using the real thing. On
this basis it is advisable to use a real Cosmos DB instance.

The app uses `local.settings.json` for local development.
[.local.settings.json](.local.settings.json) can be used as the
basis as it contains all required env vars with the exception of secrets which
have been removed. The connection string for Azurite is included as this is not
a secret.

## License

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT
LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and
applications when using this information.

> Contains public sector information licensed under the Open Government license
> v3

### About the license

The Open Government Licence (OGL) was developed by the Controller of Her
Majesty's Stationery Office (HMSO) to enable information providers in the
public sector to license the use and re-use of their information under a common
open licence.

It is designed to encourage use and re-use of information freely and flexibly,
with only a few conditions.
