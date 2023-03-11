<script>
  import { fade } from "svelte/transition";
</script>

<div id="settingsTabMods" class="settingsTab" in:fade="{{ delay: 250, duration: 250 }}" out:fade="{{ duration: 250 }}">
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">Mod Settings</span>
    <span class="settingsTabHeaderDesc">Enable or disable mods.</span>
  </div>
  <div class="settingsSelServContainer">
    <div class="settingsSelServContent"></div>
    <div class="settingsSwitchServerContainer">
      <div class="settingsSwitchServerContent">
        <button class="settingsSwitchServerButton">Switch</button>
      </div>
    </div>
  </div>
  <div id="settingsModsContainer">
    <div id="settingsReqModsContainer">
      <div class="settingsModsHeader">Required Mods</div>
      <div id="settingsReqModsContent"></div>
    </div>
    <div id="settingsOptModsContainer">
      <div class="settingsModsHeader">Optional Mods</div>
      <div id="settingsOptModsContent"></div>
    </div>
    <div id="settingsDropinModsContainer">
      <div class="settingsModsHeader">Drop-in Mods</div>
      <button id="settingsDropinFileSystemButton"
        >+ Add Mods <span id="settingsDropinRefreshNote">(F5 to Refresh)</span></button
      >
      <div id="settingsDropinModsContent"></div>
    </div>
    <div id="settingsShadersContainer">
      <div class="settingsModsHeader">Shaderpacks</div>
      <div id="settingsShaderpackDesc">
        Enable or disable shaders. Please note, shaders will only run smoothly on powerful setups. You may add custom
        packs here.
      </div>
      <div id="settingsShaderpackWrapper">
        <button id="settingsShaderpackButton"> + </button>
        <div class="settingsSelectContainer">
          <div class="settingsSelectSelected" id="settingsShadersSelected">Select Shaderpack</div>
          <div class="settingsSelectOptions" id="settingsShadersOptions" hidden></div>
        </div>
      </div>
    </div>
  </div>
</div>
