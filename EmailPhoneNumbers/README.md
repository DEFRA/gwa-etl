# Email Phone Numbers - JavaScript

> Triggers on phone number CSV file in blob storage.

## Detail

The function triggers on the phone numbers CSV file in blob storage. The file
contains a list of all active phone numbers and is generated during the
[ImportData](../ImportData) function execution.

The function creates an encrypted, password protected archive and uploads it to
the same storage container where the original file exists.
A [SAS URI](https://docs.microsoft.com/en-us/rest/api/storageservices/delegate-access-with-shared-access-signature)
with a 29 day lifetime is generated and
[sent by email](https://docs.notifications.service.gov.uk/node.html#send-an-email)
using GOV.UK Notify to a email address accessible by Administrators of
`gwa-web`.

## Notes

### 29 day lifetime for SAS

29 days was chosen for the SAS lifetime as it was felt 4 weeks would provide
enough time for any problems to be resolved, should there be an issue with the
emailing of future links.
