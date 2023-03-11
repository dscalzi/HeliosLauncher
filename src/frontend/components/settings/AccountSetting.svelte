<script>
  import { fade } from "svelte/transition";
</script>

<div
  id="settingsTabAccount"
  class="settingsTab"
  in:fade="{{ delay: 250, duration: 250 }}"
  out:fade="{{ duration: 250 }}"
>
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">Account Settings</span>
    <span class="settingsTabHeaderDesc">Add new accounts or manage existing ones.</span>
  </div>
  <div class="settingsAuthAccountTypeContainer">
    <div class="settingsAuthAccountTypeHeader">
      <div class="settingsAuthAccountTypeHeaderLeft">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 23 23">
          <path fill="#f35325" d="M1 1h10v10H1z"></path>
          <path fill="#81bc06" d="M12 1h10v10H12z"></path>
          <path fill="#05a6f0" d="M1 12h10v10H1z"></path>
          <path fill="#ffba08" d="M12 12h10v10H12z"></path>
        </svg>
        <span>Microsoft</span>
      </div>
      <div class="settingsAuthAccountTypeHeaderRight">
        <button class="settingsAddAuthAccount" id="settingsAddMicrosoftAccount">+ Add Microsoft Account</button>
      </div>
    </div>

    <div class="settingsCurrentAccounts" id="settingsCurrentMicrosoftAccounts">
      <!-- Microsoft auth accounts populated here. -->
    </div>
  </div>

  <div class="settingsAuthAccountTypeContainer">
    <div class="settingsAuthAccountTypeHeader">
      <div class="settingsAuthAccountTypeHeaderLeft">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 9.677 9.667">
          <path d="M-26.332-12.098h2.715c-1.357.18-2.574 1.23-2.715 2.633z" fill="#fff"></path>
          <path
            d="M2.598.022h7.07L9.665 7c-.003 1.334-1.113 2.46-2.402 2.654H0V2.542C.134 1.2 1.3.195 2.598.022z"
            fill="#db2331"></path>
          <path
            d="M1.54 2.844c.314-.76 1.31-.46 1.954-.528.785-.083 1.503.272 2.1.758l.164-.9c.327.345.587.756.964 1.052.28.254.655-.342.86-.013.42.864.408 1.86.54 2.795l-.788-.373C6.9 4.17 5.126 3.052 3.656 3.685c-1.294.592-1.156 2.65.06 3.255 1.354.703 2.953.51 4.405.292-.07.42-.34.87-.834.816l-4.95.002c-.5.055-.886-.413-.838-.89l.04-4.315z"
            fill="#fff"></path>
        </svg>
        <span>Mojang</span>
      </div>
      <div class="settingsAuthAccountTypeHeaderRight">
        <button class="settingsAddAuthAccount" id="settingsAddMojangAccount">+ Add Mojang Account</button>
      </div>
    </div>

    <div class="settingsCurrentAccounts" id="settingsCurrentMojangAccounts">
      <!-- Mojang auth accounts populated here. -->
    </div>
  </div>
</div>
