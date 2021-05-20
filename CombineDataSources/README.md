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

Currently this function just copies and validates the data against the schema
for the single file from the combining of AW and AAD data into blob storage
that will trigger the execution of [ImportData](../ImportData).

The reason the function exists is to make it easier in future to add the code
to combine all of the files in storage before exporting the data into a file
that will eventually be imported into the database.
