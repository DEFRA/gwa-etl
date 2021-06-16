# Combine Data Sources - JavaScript

> Triggers on files in the `DATA_SOURCES_CONTAINER`. All valid users from all
> files in the container and combined into a single file.

## Detail

The function triggers on files in the `data-sources` blob storage container.
The container contains the combined dataset from
[CombineUserData](../CombineUserData) along with other organisation's data
files. The organisation data files contain user data uploaded from
[gwa-web](https://github.com/DEFRA/gwa-web).

The contents of all files in the container is loaded and processed. Duplicate
users are processed. Duplicates with an entry in the core data
(i.e. any users in `internal-users.json`) that entry is used with the other
being ignored. Duplicate entries not in the core dataset are not deemed as
valid and are output to a file (`duplicate.json`) for later inspection.

When duplicates have been removed the users are validated against a schema to
ensure they are valid and are OK to be moved to the next stage. If the
validation fails the user is not eligible and will be added to an
`error-users.json` file for later inspection. Users that pass validation will be
uploaded to the next stage in `valid-users.json`.
