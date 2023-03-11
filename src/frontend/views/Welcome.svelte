<style>
</style>

<script lang="ts">
  import { fade } from "svelte/transition";
  import { currentView } from "../store/AppStore.js";
  import { PossibleViewState } from "../types/PossibleAppState.js";
</script>

<div id="welcomeContainer" out:fade>
  <div id="welcomeContent">
    <img id="welcomeImageSeal" src="assets/images/SealCircle.png" alt="Bienvenue" />
    <span id="welcomeHeader">WELCOME TO WESTEROSCRAFT</span>
    <span id="welcomeDescription"
      >Our mission is to recreate the universe imagined by author George RR Martin in his fantasy series, A Song of Ice
      and Fire. Through the collaborative effort of thousands of community members, we have sought to create Westeros as
      accurately and precisely as possible within Minecraft. The world we are creating is yours to explore. Journey from
      Dorne to Castle Black, and if you aren’t afraid, beyond the Wall itself, but best not delay. As the words of House
      Stark ominously warn: Winter is Coming.</span
    >
    <br />
    <span id="welcomeDescCTA">You are just a few clicks away from Westeros.</span>
    <button id="welcomeButton" on:click="{(e) => currentView.set(PossibleViewState.LoginOptions)}">
      <div id="welcomeButtonContent">
        CONTINUE
        <svg id="welcomeSVG" viewBox="0 0 24.87 13.97">
          <defs>
            <style>
              .arrowLine {
                fill: none;
                stroke: #fff;
                stroke-width: 2px;
                transition: 0.25s ease;
              }
            </style>
          </defs>
          <polyline class="arrowLine" points="0.71 13.26 12.56 1.41 24.16 13.02"></polyline>
        </svg>
      </div>
    </button>
  </div>
</div>
