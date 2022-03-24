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
8. Navigate back to **Overview**.
9. Copy **Application (client) ID**.


Reference: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app

## Adding the Azure Client ID to Helios Launcher.

In `app/assets/js/ipcconstants.js` you'll find **`AZURE_CLIENT_ID`**. Set it to your application's id.

Note: Azure Client ID is NOT a secret value and **can** be stored in git. Reference: https://stackoverflow.com/questions/57306964/are-azure-active-directorys-tenantid-and-clientid-considered-secrets

----

You can now authenticate with Microsoft through the launcher.