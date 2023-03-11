<script>
  import { fade } from "svelte/transition";
</script>

<div
  id="settingsTabLauncher"
  class="settingsTab"
  in:fade="{{ delay: 250, duration: 250 }}"
  out:fade="{{ duration: 250 }}"
>
  <div class="settingsTabHeader">
    <span class="settingsTabHeaderText">Launcher Settings</span>
    <span class="settingsTabHeaderDesc">Options related to the launcher itself.</span>
  </div>
  <div class="settingsFieldContainer">
    <div class="settingsFieldLeft">
      <span class="settingsFieldTitle">Allow Pre-Release Updates.</span>
      <span class="settingsFieldDesc"
        >Pre-Releases include new features which may have not been fully tested or integrated.<br />This will always be
        true if you are using a pre-release version.</span
      >
    </div>
    <div class="settingsFieldRight">
      <label class="toggleSwitch">
        <input type="checkbox" cValue="AllowPrerelease" />
        <span class="toggleSwitchSlider"></span>
      </label>
    </div>
  </div>
  <div class="settingsFileSelContainer">
    <div class="settingsFileSelContent">
      <div class="settingsFieldTitle" id="settingsDataDirTitle">Data Directory</div>
      <div class="settingsFileSelActions">
        <div class="settingsFileSelIcon">
          <svg class="settingsFileSelSVG">
            <g>
              <path
                fill="gray"
                d="m10.044745,5c0,0.917174 -0.746246,1.667588 -1.667588,1.667588l-4.168971,0l-2.501382,0c-0.921009,0 -1.667588,0.750415 -1.667588,1.667588l0,6.670353l0,2.501382c0,0.917174 0.746604,1.667588 1.667588,1.667588l16.675882,0c0.921342,0 1.667588,-0.750415 1.667588,-1.667588l0,-2.501382l0,-8.337941c0,-0.917174 -0.746246,-1.667588 -1.667588,-1.667588l-8.337941,0z"
              ></path>
              <path
                fill="gray"
                d="m1.627815,1.6c-0.921009,0 -1.667588,0.746579 -1.667588,1.667588l0,4.168971l8.337941,0l0,0.833794l11.673118,0l0,-4.168971c0,-0.921009 -0.746246,-1.667588 -1.667588,-1.667588l-8.572237,0c-0.288493,-0.497692 -0.816284,-0.833794 -1.433292,-0.833794l-6.670353,0z"
              ></path>
              <path
                fill="lightgray"
                d="m10.025276,4c0,0.918984 -0.747719,1.670879 -1.670879,1.670879l-4.177198,0l-2.506319,0c-0.922827,0 -1.670879,0.751896 -1.670879,1.670879l0,6.683517l0,2.506319c0,0.918984 0.748078,1.670879 1.670879,1.670879l16.708794,0c0.923161,0 1.670879,-0.751896 1.670879,-1.670879l0,-2.506319l0,-8.354397c0,-0.918984 -0.747719,-1.670879 -1.670879,-1.670879l-8.354397,0z"
              ></path>
            </g>
          </svg>
        </div>
        <input class="settingsFileSelVal" type="text" value="null" cValue="DataDirectory" disabled />
        <button class="settingsFileSelButton" dialogTitle="Select Data Directory" dialogDirectory="true"
          >Choose Folder</button
        >
      </div>
    </div>
    <div class="settingsFileSelDesc">
      All game files and local Java installations will be stored in the data directory.<br />Screenshots and world saves
      are stored in the instance folder for the corresponding server configuration.
    </div>
  </div>
</div>
