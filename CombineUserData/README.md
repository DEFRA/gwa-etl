# Combine User Data - JavaScript

> Triggers on files in blob storage that contain AirWatch and Azure Active
> Directory data extracts.

## Detail

The function triggers on files in blob storage containing extracts from
AirWatch (email and phone number(s)) and Azure Active Directory (email, base
location).

The function will combine the two datasets (on email address) and upload the
file to blob storage. The file containing the combined datasets will be handled
by [CombineDataSources](../CombineDataSources).

Files are left in the container once they have been processed. This results in
either of the extracts being able to be run independently and when this
function is triggered the latest extract data will be whatever is in the
existing file.
