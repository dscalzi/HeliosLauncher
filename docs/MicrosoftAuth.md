# Microsoft Authentication

Authenticating with Microsoft is fully supported by Helios Launcher.

## Acquiring an Azure Client ID

1. Navigate to https://portal.azure.com
2. In the search bar, search for **Azure Active Directory**.
3. In Azure Active Directory, go to **App Registrations** on the left pane (Under *Manage*).
4. Click **New Registration**.
    - Set **Name** to be your launcher's name.
    - Set **Supported account types** to *Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)*
    - Leave **Redirect URI** blank.
    - Register the application.
5. You should be on the application's management page. If not, Navigate back to **App Registrations**. Select the application you just registered.
6. Click **Authentication** on the left pane (Under *Manage*).
7. Click **Add Platform**.
    - Select **Mobile and desktop applications**.
    - Choose `https://login.microsoftonline.com/common/oauth2/nativeclient` as the **Redirect URI**.
    - Select **Configure** to finish adding the platform.
8. Go to **Credentials & secrets**.
    - Select **Client secrets**.
    - Click **New client secret**.
    - Set a description.
    - Click **Add**.
    - Don't copy the client secret, adding one is just a requirement from Microsoft.
8. Navigate back to **Overview**.
9. Copy **Application (client) ID**.


## Adding the Azure Client ID to Helios Launcher.

In `app/assets/js/ipcconstants.js` you'll find **`AZURE_CLIENT_ID`**. Set it to your application's id.

Note: Azure Client ID is NOT a secret value and **can** be stored in git. Reference: https://stackoverflow.com/questions/57306964/are-azure-active-directorys-tenantid-and-clientid-considered-secrets

Then relaunch your app, and login. You'll be greeted with an error message, because the app isn't whitelisted yet. Microsoft needs some activity on the app before whitelisting it. __Trying to log in before requesting whitelist is mandatory.__

## Requesting whitelisting from Microsoft

1. Ensure you have completed every step of this doc page.
2. Fill [this form](https://aka.ms/mce-reviewappid) with the required information. Remember this is a new appID for approval. You can find both the Client ID and the Tenant ID on the overview page in the Azure Portal.
3. Give Microsoft some time to review your app.
4. Once you have received Microsoft's approval, allow up to 24 hours for the changes to apply.

----

You can now authenticate with Microsoft through the launcher.

References:
- https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
- https://help.minecraft.net/hc/en-us/articles/16254801392141