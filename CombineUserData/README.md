# Combine User Data - JavaScript

> Triggers on files in blob storage that contain AirWatch (AW) and Azure Active
> Directory (AAD) data extracts.

## Detail

The function triggers on files in blob storage containing extracts from
AW (email and phone number(s)) and AAD (email, base location).

The function will combine the two datasets (on email address) and upload the
file to blob storage. Users _should_ have at least one corporate phone number,
however, if none exist the user will have an empty array added. This is
important as every user will be validated to check the existence of
`phoneNumbers` prior to being imported into the database. The file containing
the combined datasets will be handled by
[CombineDataSources](../CombineDataSources).

Files are left in the container once they have been processed. This results in
either of the extracts being able to be run independently and when this
function is triggered the latest extract data will be whatever is in the
existing file.
