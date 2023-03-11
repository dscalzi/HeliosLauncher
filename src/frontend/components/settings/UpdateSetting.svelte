<script>
  import { fade } from "svelte/transition";
</script>

<div
  id="settingsTabUpdate"
  class="settingsTab"
  in:fade="{{ delay: 250, duration: 250 }}"
  out:fade="{{ duration: 250 }}"
>
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">Launcher Updates</span>
    <span class="settingsTabHeaderDesc">Download, install, and review updates for the launcher.</span>
  </div>
  <div id="settingsUpdateStatusContainer">
    <div id="settingsUpdateStatusContent">
      <div id="settingsUpdateStatusHeadline">
        <span id="settingsUpdateTitle">You Are Running the Latest Version</span>
      </div>
      <div id="settingsUpdateVersion">
        <div id="settingsUpdateVersionCheck">&#10003;</div>
        <div id="settingsUpdateVersionDetails">
          <span id="settingsUpdateVersionTitle">Stable Release</span>
          <div id="settingsUpdateVersionLine">
            <span id="settingsUpdateVersionText">Version </span>
            <span id="settingsUpdateVersionValue">0.0.1-alpha.18</span>
          </div>
        </div>
      </div>
      <div id="settingsUpdateActionContainer">
        <button id="settingsUpdateActionButton">Check for Updates</button>
      </div>
    </div>
  </div>
  <div class="settingsChangelogContainer">
    <div class="settingsChangelogContent">
      <div class="settingsChangelogHeadline">
        <div class="settingsChangelogLabel">What's New</div>
        <div class="settingsChangelogTitle">Update Release Notes</div>
      </div>
      <div class="settingsChangelogText">No Release Notes</div>
    </div>
  </div>
</div>
