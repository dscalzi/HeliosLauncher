<script>
  import { fade } from "svelte/transition";
</script>

<div id="settingsTabAbout" class="settingsTab" in:fade="{{ delay: 250, duration: 250 }}" out:fade="{{ duration: 250 }}">
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">About</span>
    <span class="settingsTabHeaderDesc">View information and release notes for the current version.</span>
  </div>
  <div id="settingsAboutCurrentContainer">
    <div id="settingsAboutCurrentContent">
      <div id="settingsAboutCurrentHeadline">
        <img id="settingsAboutLogo" src="./assets/images/SealCircle.png" />
        <span id="settingsAboutTitle">Helios Launcher</span>
      </div>
      <div id="settingsAboutCurrentVersion">
        <div id="settingsAboutCurrentVersionCheck">&#10003;</div>
        <div id="settingsAboutCurrentVersionDetails">
          <span id="settingsAboutCurrentVersionTitle">Stable Release</span>
          <div id="settingsAboutCurrentVersionLine">
            <span id="settingsAboutCurrentVersionText">Version </span>
            <span id="settingsAboutCurrentVersionValue">0.0.1-alpha.12</span>
          </div>
        </div>
      </div>
    </div>
    <div id="settingsAboutButtons">
      <a href="https://github.com/dscalZi/HeliosLauncher" id="settingsAboutSourceButton" class="settingsAboutButton"
        >Source (GitHub)</a
      >
      <!-- The following must be included in third-party usage. -->
      <!-- <a href="https://github.com/dscalzi/HeliosLauncher" id="settingsAboutSourceButton" class="settingsAboutButton">Original Source</a> -->
      <a
        href="https://github.com/dscalZi/HeliosLauncher/issues"
        id="settingsAboutSupportButton"
        class="settingsAboutButton">Support</a
      >
      <a href="#" id="settingsAboutDevToolsButton" class="settingsAboutButton">DevTools Console</a>
    </div>
  </div>
  <div class="settingsChangelogContainer">
    <div class="settingsChangelogContent">
      <div class="settingsChangelogHeadline">
        <div class="settingsChangelogLabel">Release Notes</div>
        <div class="settingsChangelogTitle">Changelog</div>
      </div>
      <div class="settingsChangelogText">No Release Notes</div>
    </div>
    <div class="settingsChangelogActions">
      <a class="settingsChangelogButton settingsAboutButton" href="#">View Release Notes on GitHub</a>
    </div>
  </div>
</div>
