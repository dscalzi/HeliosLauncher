<script>
  import { fade } from "svelte/transition";
</script>

<div
  id="settingsTabMinecraft"
  class="settingsTab"
  in:fade="{{ delay: 250, duration: 250 }}"
  out:fade="{{ duration: 250 }}"
>
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">Minecraft Settings</span>
    <span class="settingsTabHeaderDesc">Options related to game launch.</span>
  </div>
  <div id="settingsGameResolutionContainer">
    <span class="settingsFieldTitle">Game Resolution</span>
    <div id="settingsGameResolutionContent">
      <input type="number" id="settingsGameWidth" min="0" cValue="GameWidth" />
      <div id="settingsGameResolutionCross">&#10006;</div>
      <input type="number" id="settingsGameHeight" min="0" cValue="GameHeight" />
    </div>
  </div>
  <div class="settingsFieldContainer">
    <div class="settingsFieldLeft">
      <span class="settingsFieldTitle">Launch in fullscreen.</span>
    </div>
    <div class="settingsFieldRight">
      <label class="toggleSwitch">
        <input type="checkbox" cValue="Fullscreen" />
        <span class="toggleSwitchSlider"></span>
      </label>
    </div>
  </div>
  <div class="settingsFieldContainer">
    <div class="settingsFieldLeft">
      <span class="settingsFieldTitle">Automatically connect to the server on launch.</span>
    </div>
    <div class="settingsFieldRight">
      <label class="toggleSwitch">
        <input type="checkbox" cValue="AutoConnect" />
        <span class="toggleSwitchSlider"></span>
      </label>
    </div>
  </div>
  <div class="settingsFieldContainer">
    <div class="settingsFieldLeft">
      <span class="settingsFieldTitle">Launch game process detached from launcher.</span>
      <span class="settingsFieldDesc">If the game is not detached, closing the launcher will also close the game.</span>
    </div>
    <div class="settingsFieldRight">
      <label class="toggleSwitch">
        <input type="checkbox" cValue="LaunchDetached" />
        <span class="toggleSwitchSlider"></span>
      </label>
    </div>
  </div>
</div>
