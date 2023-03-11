<style>
  main {
    height: calc(100% - 22px);
    background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 100%);
    width: 100%;
    position: absolute;
    z-index: 10;
    overflow: hidden;
  }

  /* Loading container, placed above everything. */
  #loadingContainer {
    position: absolute;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: calc(100% - 22px);
    background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 100%);
  }

  /* Loading content container. */
  #loadingContent {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Spinner container. */
  #loadSpinnerContainer {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Stationary image for the spinner. */
  #loadCenterImage {
    position: absolute;
    width: 277px;
    height: auto;
  }

  /* Rotating image for the spinner. */
  #loadSpinnerImage {
    width: 280px;
    height: auto;
    z-index: 400;
  }

  /* Rotating animation for the spinner. */
  @keyframes rotating {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Class which is applied when the spinner image is spinning. */
  .rotating {
    animation: rotating 10s linear infinite;
  }
</style>

<script lang="ts">
  import { SvelteComponent, SvelteComponentTyped } from "svelte";
  import { fade } from "svelte/transition";

  import { currentView, mainReady } from "./store/AppStore";
  import { PossibleViewState } from "./types/PossibleAppState.js";
  import Frame from "./views/Frame.svelte";
  import Landing from "./views/Landing.svelte";
  import Login from "./views/Login.svelte";
  import LoginOptions from "./views/LoginOptions.svelte";
  import Overlay from "./views/Overlay.svelte";
  import Settings from "./views/Settings.svelte";
  import WaitingMicrosoft from "./views/WaitingMicrosoft.svelte";
  import Welcome from "./views/Welcome.svelte";

  const views = [Welcome, Login, WaitingMicrosoft, LoginOptions, Settings, Landing];
  let isPreloading = false;

  setTimeout(() => {
    currentView.set(PossibleViewState.Welcome);
  }, 1000);

  currentView.subscribe((value) => {
    if (value == PossibleViewState.Loading) {
      isPreloading = true;
      return;
    }
    if (isPreloading) isPreloading = false;
  });

  mainReady.set(true);
  document.body.style.backgroundImage = `url('./assets/images/backgrounds/${Math.floor(Math.random() * 7)}.jpg')`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundRepeat = "no-repeat";
</script>

<Frame />
{#if views[$currentView]}
  <main>
    <svelte:component this="{views[$currentView]}" />
  </main>
{/if}
<Overlay />

{#if isPreloading}
  <div id="loadingContainer" out:fade>
    <div id="loadingContent">
      <div id="loadSpinnerContainer">
        <img id="loadCenterImage" src="./assets/images/LoadingSeal.png" alt="Preload" />
        <img id="loadSpinnerImage" class="rotating" src="./assets/images/LoadingText.png" alt="Preload" />
      </div>
    </div>
  </div>
{/if}
