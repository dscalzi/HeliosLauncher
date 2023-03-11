<script>
  import { fade } from "svelte/transition";
  import { currentView } from "../store/AppStore";
  import { PossibleViewState } from "../types/PossibleAppState";

  setTimeout(() => {
    currentView.set(PossibleViewState.Landing);
  }, 750);
</script>

<div id="waitingContainer" class="absolute" in:fade="{{ delay: 500 }}" out:fade>
  <div id="waitingContent">
    <div class="waitingSpinner"></div>
    <div id="waitingTextContainer">
      <h2>Waiting for Microsoft..</h2>
    </div>
  </div>
</div>
