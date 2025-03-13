**Documentation: ExtraFileVerification for HeliosLauncher**

### Introduction
HeliosLauncher is a game launcher for Minecraft developed by Daniel Scalzi, designed to provide a secure and optimized gaming experience. To maintain game integrity and prevent unauthorized or altered mods, I have implemented a new security system called ExtraFileVerification.

### Purpose of ExtraFileVerification
The main purpose of ExtraFileVerification is to ensure that only authorized and verified mods are used with HeliosLauncher. This system checks the integrity of installed mods to prevent any modifications or additions of malicious or unapproved mods.

### Key Features

**Installed Mod Validation:**

- Before launching the game, ExtraFileVerification verifies the mods present in the HeliosLauncher mods folder.
- Each mod is validated by comparing its name and hash (digital fingerprint) with expected data in the distribution.
- If a mod does not meet validation criteria, game launch is stopped, and an error message is displayed.

**First Launch Verification:**

- On the first launch of HeliosLauncher, if the mods folder is empty, the game is launched without mod verification.
- If mods are detected on the first launch, their validity is checked immediately to prevent issues.

**Modification Management:**

- ExtraFileVerification also verifies changes to mods. For instance, if a mod is deleted, replaced, or renamed, it will be detected.
- Hash verification ensures that mods have not been altered since their initial download.

**Error Messages and Instructions:**

- If any invalid mods or unauthorized modifications are detected, the system displays a clear error message.
- Users are provided with specific instructions to resolve issues, such as deleting the mods folder and restarting the launcher.

### User Benefits

- **Enhanced Security:** By preventing unauthorized mods and verifying integrity, ExtraFileVerification protects users from malicious mods.
- **Reliable Gaming Experience:** Ensures that only tested and validated mods are used, guaranteeing a stable and trouble-free gaming experience.
- **Ease of Use:** Users are guided with clear messages and instructions to help resolve any potential conflicts, simplifying problem-solving.

### Conclusion
ExtraFileVerification is a significant step toward enhancing the security and integrity of HeliosLauncher. With this integration, I ensure that every Minecraft user enjoys a safe and reliable gaming experience, without compromising on quality or security.

If you have any questions or need further clarification about ExtraFileVerification, feel free to contact me.

**The only way to bypass ExtraFileVerification would be through advanced cryptography knowledge, involving signature copying or hash modification.**

The creation and verification of ExtraFileVerification are currently complete, though additional improvements may be made in the future, as with any project.

Respectfully,  
**SORIA Sandro (Sandro642)**
