<script lang="ts">
  import { fade } from "svelte/transition";
  import AboutSetting from "../components/settings/AboutSetting.svelte";
  import AccountSetting from "../components/settings/AccountSetting.svelte";
  import JavaSetting from "../components/settings/JavaSetting.svelte";
  import LauncherSetting from "../components/settings/LauncherSetting.svelte";
  import MinecraftSetting from "../components/settings/MinecraftSetting.svelte";
  import ModSetting from "../components/settings/ModSetting.svelte";
  import UpdateSetting from "../components/settings/UpdateSetting.svelte";
  import { currentView } from "../store/AppStore";
  import { PossibleViewState } from "../types/PossibleAppState";

  enum PossibleSettingState {
    Account,
    Minecraft,
    Mods,
    Java,
    Launcher,
    About,
    Update,
  }

  let currentState: PossibleSettingState = PossibleSettingState.Account;
</script>

<div id="settingsContainer" in:fade="{{ delay: 500 }}" out:fade>
  <div id="settingsContainerLeft">
    <div id="settingsNavContainer">
      <div id="settingsNavHeader">
        <span id="settingsNavHeaderText">Settings</span>
      </div>
      <div id="settingsNavItemsContainer">
        <div id="settingsNavItemsContent">
          <button
            class="settingsNavItem"
            id="settingsNavAccount"
            class:selected="{currentState == PossibleSettingState.Account}"
            on:click="{(_e) => (currentState = PossibleSettingState.Account)}"
          >
            Account
          </button>
          <button
            class="settingsNavItem"
            class:selected="{currentState == PossibleSettingState.Minecraft}"
            on:click="{(_e) => (currentState = PossibleSettingState.Minecraft)}">Minecraft</button
          >
          <button
            class="settingsNavItem"
            class:selected="{currentState == PossibleSettingState.Mods}"
            on:click="{(_e) => (currentState = PossibleSettingState.Mods)}">Mods</button
          >
          <button
            class="settingsNavItem"
            class:selected="{currentState == PossibleSettingState.Java}"
            on:click="{(_e) => (currentState = PossibleSettingState.Java)}">Java</button
          >
          <button
            class="settingsNavItem"
            class:selected="{currentState == PossibleSettingState.Launcher}"
            on:click="{(_e) => (currentState = PossibleSettingState.Launcher)}"
          >
            Launcher</button
          >
          <div class="settingsNavSpacer"></div>
          <button
            class="settingsNavItem"
            class:selected="{currentState == PossibleSettingState.About}"
            on:click="{(_e) => (currentState = PossibleSettingState.About)}">About</button
          >
          <button
            class="settingsNavItem"
            id="settingsNavUpdate"
            class:selected="{currentState == PossibleSettingState.Update}"
            on:click="{(_e) => (currentState = PossibleSettingState.Update)}">Updates</button
          >
          <div id="settingsNavContentBottom">
            <div class="settingsNavDivider"></div>
            <button id="settingsNavDone" on:click="{(e) => currentView.set(PossibleViewState.Landing)}">Done</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div id="settingsContainerRight">
    {#if currentState === PossibleSettingState.Account}
      <AccountSetting />
    {:else if currentState === PossibleSettingState.Minecraft}
      <MinecraftSetting />
    {:else if currentState === PossibleSettingState.Mods}
      <ModSetting />
    {:else if currentState === PossibleSettingState.Java}
      <JavaSetting />
    {:else if currentState === PossibleSettingState.Launcher}
      <LauncherSetting />
    {:else if currentState === PossibleSettingState.About}
      <AboutSetting />
    {:else if currentState === PossibleSettingState.Update}
      <UpdateSetting />
    {/if}
  </div>
</div>
