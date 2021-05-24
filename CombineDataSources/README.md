# Combine Data Sources - JavaScript

> Triggers on files containing the combined dataset extracts from AirWatch (AW)
> and Azure Active Directory (AAD).

## Detail

The function triggers on files in blob storage containing the combined dataset
from [CombineUserData](../CombineUserData) and other sources (TBD).

Each user in the data is checked against a schema to ensure it is valid and
should be moved to the next stage. If the validation fails the user is not
eligible and will be added to an `error-user.json` file for later inspection.
Users that pass validation will be uploaded to the next stage in
`all-users.json`.

## Note

Currently this function copies and validates the data against the schema
for the single file from the combining of AW and AAD data into blob storage
that will trigger the execution of [ImportData](../ImportData).

Future developments are likely to include the ability for external data files
to be uploaded which would then be combined within this function. When (if)
that time comes it _should_ be a case of concatenating all of the files in the
container.
