# Combine Data Sources - JavaScript

> Triggers on files containing the combined dataset extracts from AirWatch (AW)
> and Azure Active Directory (AAD).

## Detail

The function triggers on files in blob storage containing the combined dataset
from [CombineUserData](../CombineUserData) and other sources (TBD).

## Note

Currently this function just copies the single file from the combining of AW
and AAD data into blob storage that will trigger the execution of
[Import](../Import).

The reason the function exists is to make it easier in future to add the code
to combine all of the files in storage before exporting the data into a file
that will be imported.
