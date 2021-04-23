# Extract AirWatch Data - JavaScript

> Triggers on a timer, extracting user data from an
> [AirWatch](https://www.vmware.com/products/workspace-one.html) API.

## Detail

The function triggers on a timer to make a request to the
[AirWatch REST API](https://resources.workspaceone.com/view/zv5cgwjrcv972rd6fmml/en),
specifically the `DevicesV2` (`/devices/search`) endpoint.

All devices will be retrieved (500 per page) and for those devices with a
`UserEmailAddress` both the email and `PhoneNumber` will be saved in a file
which will be uploaded to blob storage. This will trigger execution of the
[CombineUserData](./CombineUserData) function.

There is no check on whether the phone number is populated. This is so that the
scenario of a person being registered in AW and without a phone number they
will still be in the system so they will be able to login to the web app and
add additional devices. If only users with email and phone numbers were added
this would not be possible.

### Note on file `Content-Type`

The file is saved via blob storage
[output binding](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-blob-output?tabs=javascript).
Using the output binding sets the `Content-Type` of the file to
`application/octet-stream`. It is not possible to override this, more
information available in
[issue#364](https://github.com/Azure/azure-functions-host/issues/364).
Currently this isn't a problem so it will be left as it. If there is a problem
the way to solve it is to use the
[@azure/storage-blob](https://www.npmjs.com/package/@azure/storage-blob)
package to set the `Content-Type` to be `application/json` .
