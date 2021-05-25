# Extract Azure Active Directory Data - JavaScript

> Triggers on a timer, extracting user data from the
> [Microsoft Graph API](https://microsoft.graph.com).

## Detail

The function triggers on a [timer](./function.json) making a request to the
[Microsoft Graph API](https://microsoft.graph.com),
specifically the
[list users](https://docs.microsoft.com/en-us/graph/api/user-list?)
(`/users`) endpoint.

All users
([user resource type](https://docs.microsoft.com/en-us/graph/api/resources/user))
will be retrieved and saved in a file which will be uploaded to blob
storage. This will trigger execution of the
[CombineUserData](./CombineUserData) function. The request is filtered to
return only users with `accountEnabled = true` and `mail != null`.

Only properties relevant for filtering the message sending i.e.
`officeLocation`, `companyName` and `mail` will be saved along with the
`givenName` and `surname` to provide a better experience for the user.
`officeLocation` is mapped to a 'clean' subset of the raw office locations
including an area code. An example is a raw `officeLocation` of
`1 long lane, not a real address` would be mapped to `LDN:1-Long-Lane` where
`LDN` is an area code that would probably represent `London` (all of these are
made up in this example). The key is the format of a three letter area code
followed by a colon followed by a clean office location with spaces that have
been replaced with hyphens (`-`).

## Notes

### Exported file's `Content-Type`

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
