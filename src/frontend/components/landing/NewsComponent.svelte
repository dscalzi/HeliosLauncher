<style>
  #newsContainer.hideNewsSection {
    top: 100%;
  }
  #newsContainer {
    top: 0px;
  }
</style>

<script lang="ts">
  type News = {
    author: string;
    date: Date;
    title: string;
    comments: string[];
    content: string;
    url: string;
  };

  export let showNews = false;
  let hasError = false;
  let news: News[] = [];
  let loading = true;
  let currentNewIndex = -1;
  $: displayedValue = news[currentNewIndex];

  setTimeout(() => {
    hasError = true;
    loading = false;
  }, 2000);

  function handleReloading() {
    hasError = false;
    loading = true;
    setTimeout(() => {
      const newToPush = {
        author: "Shadowner",
        comments: ["hello", "world"],
        content:
          "Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore sint laboriosam, autem, ad, hic doloremque eligendi dolorum facere totam reiciendis maxime quia porro? Quae nemo vel modi neque nisi? Illum!",
        date: new Date(),
        title: "Svelte is coming to the Party",
        url: "http://localhost/",
      };

      news.push(newToPush, newToPush, newToPush, newToPush, newToPush, newToPush, newToPush, newToPush, newToPush);
      currentNewIndex = 0;
      loading = false;
    }, 1000);
  }

  function handleNext() {
    if (currentNewIndex < news.length - 1) currentNewIndex++;
  }

  function handlePrevious() {
    if (currentNewIndex > 0) currentNewIndex--;
  }
</script>

<div id="newsContainer" class:hideNewsSection="{!showNews}">
  {#if !loading && news.length > 0 && displayedValue}
    <div id="newsContent">
      <div id="newsStatusContainer">
        <div id="newsStatusContent">
          <div id="newsTitleContainer">
            <a id="newsArticleTitle" href="{displayedValue.url}">{displayedValue.title}</a>
          </div>
          <div id="newsMetaContainer">
            <div id="newsArticleDateWrapper">
              <span id="newsArticleDate">{displayedValue.date.toLocaleDateString()}</span>
            </div>
            <div id="newsArticleAuthorWrapper">
              <span id="newsArticleAuthor">by {displayedValue.author}</span>
            </div>
            <a href="{displayedValue.url}/comments" id="newsArticleComments">{displayedValue.comments?.length}</a>
          </div>
        </div>
        <div id="newsNavigationContainer">
          <button id="newsNavigateLeft" on:click="{handlePrevious}">
            <svg id="newsNavigationLeftSVG" viewBox="0 0 24.87 13.97">
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
          </button>
          <span id="newsNavigationStatus">{currentNewIndex + 1} of {news.length}</span>
          <button id="newsNavigateRight" on:click="{handleNext}">
            <svg id="newsNavigationRightSVG" viewBox="0 0 24.87 13.97">
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
          </button>
        </div>
      </div>
      <div id="newsArticleContainer">
        <div id="newsArticleContent">
          <div id="newsArticleContentScrollable">
            {displayedValue.content}
          </div>
        </div>
      </div>
    </div>
  {/if}
  <div id="newsErrorContainer">
    {#if loading && !hasError}
      <div id="newsErrorLoading">
        <span id="nELoadSpan" class="newsErrorContent">Checking for News..</span>
      </div>
    {:else if !loading && hasError}
      <div id="newsErrorFailed">
        <span id="nEFailedSpan" class="newsErrorContent">Failed to Load News</span>
        <button id="newsErrorRetry" on:click="{handleReloading}">Try Again</button>
      </div>
    {:else if news.length === 0}
      <div id="newsErrorNone">
        <span id="nENoneSpan" class="newsErrorContent">No News</span>
      </div>
    {/if}
  </div>
</div>
