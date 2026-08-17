<script lang="ts">
  import PageHero from '../../components/shared/PageHero.svelte';
  import { contentConfig } from '$lib/config';
  import { navIcons } from '$lib/svg-icons';

  const archiveIcon = navIcons.archive;
  const archivePageConfig = contentConfig.pages.archive;

  let { data } = $props();
  let archiveData = $derived(data.archiveData);
  let totalPosts = $derived(data.totalPosts);
  let selectedYear = $state<number | null>(null);

  const activeYear = $derived(
    archiveData.find((y) => y.year === selectedYear) ?? archiveData[0] ?? null,
  );

  function pad(n: number) {
    return String(n).padStart(2, '0');
  }
</script>

<svelte:head>
  <title>归档 - YukiLog</title>
  <meta name="description" content="按时间线浏览所有文章" />
</svelte:head>

<PageHero
  title="归档"
  subtitle="{archivePageConfig.heroSubtitlePrefix} {totalPosts} {archivePageConfig.heroSubtitleSuffix}"
  icon={archiveIcon}
/>

<div class="archive-page">
  {#if archiveData.length === 0}
    <p class="empty">还没有已发布的文章</p>
  {:else}
    <div class="year-tabs" role="tablist" aria-label="选择年份">
      {#each archiveData as yearGroup}
        <button
          type="button"
          class="year-tab"
          class:on={activeYear?.year === yearGroup.year}
          role="tab"
          aria-selected={activeYear?.year === yearGroup.year}
          onclick={() => (selectedYear = yearGroup.year)}
        >
          {yearGroup.year}
        </button>
      {/each}
    </div>

    {#if activeYear}
      {#each activeYear.months as monthGroup}
        <section class="month-block">
          <div class="month-head">
            <h2 class="month-label">{pad(monthGroup.month)} 月</h2>
            <span class="month-count">{monthGroup.posts.length} 篇</span>
          </div>
          <div class="month-page">
            {#each monthGroup.posts as post}
              <a class="post-row" href="/posts/{post.slug}">
                <time class="post-date" datetime={post.created_at}>
                  {pad(post.month)}-{pad(post.day)}
                </time>
                <span class="post-title">{post.title}</span>
              </a>
            {/each}
          </div>
        </section>
      {/each}

      <p class="journal-end">{archivePageConfig.timelineEndText}</p>
    {/if}
  {/if}
</div>

<style>
  .archive-page {
    max-width: 720px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg) calc(var(--spacing-xxl) * 2);
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .year-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: var(--spacing-xl);
  }

  .year-tab {
    border: none;
    background: var(--color-white);
    color: var(--color-text-light);
    padding: 8px 16px;
    border-radius: 14px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    font-family: inherit;
    cursor: pointer;
    transition:
      color var(--transition-fast) var(--ease-gentle),
      background var(--transition-fast) var(--ease-gentle);
  }

  .year-tab:hover {
    color: var(--color-blue);
    background: var(--blue-alpha-08);
  }

  .year-tab.on {
    color: var(--color-on-primary);
    background: linear-gradient(135deg, var(--color-blue), var(--color-pink));
  }

  .month-block {
    margin-bottom: var(--spacing-xl);
  }

  .month-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }

  .month-label {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-pink);
    letter-spacing: 0.08em;
  }

  .month-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    background: var(--blue-alpha-08);
    padding: 2px 10px;
    border-radius: 12px;
  }

  .month-page {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    padding: 6px 8px;
    box-shadow: var(--shadow-pink);
  }

  .post-row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 14px;
    text-decoration: none;
    transition: background var(--transition-fast) var(--ease-gentle);
  }

  .post-row:hover {
    background: var(--blue-alpha-08);
  }

  .post-date {
    font-family: var(--font-family-code);
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .post-title {
    font-size: 0.9375rem;
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    line-height: var(--line-height-base);
    transition: color var(--transition-fast) var(--ease-gentle);
  }

  .post-row:hover .post-title {
    color: var(--color-blue);
  }

  .journal-end {
    margin: var(--spacing-lg) 0 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-style: italic;
  }

  @media (max-width: 640px) {
    .archive-page {
      padding: var(--spacing-lg) var(--spacing-sm) var(--spacing-xxl);
    }

    .post-row {
      grid-template-columns: 52px minmax(0, 1fr);
      padding: 10px 12px;
    }
  }
</style>
