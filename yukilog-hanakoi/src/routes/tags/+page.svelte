<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/state';
  import PageHero from '../../components/shared/PageHero.svelte';
  import PostListCard from '../../components/shared/PostListCard.svelte';
  import { tagsApi } from '$lib/api';
  import { contentConfig } from '$lib/config';
  import { navIcons } from '$lib/svg-icons';
  import type { Tag } from '$types/api';

  const tagIcon = navIcons.tag;
  const tagsPageConfig = contentConfig.pages.tags;
  const colorCycle = tagsPageConfig.colorCycle;
  const colorNames = tagsPageConfig.colorNames;

  let { data } = $props();
  let tags = $derived(data.tags as Tag[]);
  let posts = $derived(data.posts);
  let total = $derived(data.total);

  const selectedSlugs = $derived(
    page.url.searchParams
      .getAll('tag')
      .map((slug) => slug.trim())
      .filter((slug) => tags.some((tag) => tag.slug === slug)),
  );
  const selectedSet = $derived(new Set(selectedSlugs));
  const selectedTags = $derived(
    selectedSlugs
      .map((slug) => tags.find((tag) => tag.slug === slug))
      .filter((tag): tag is Tag => Boolean(tag)),
  );
  const poolTags = $derived(tags.filter((tag) => !selectedSet.has(tag.slug)));

  function tagsHref(slugs: string[]): string {
    const params = new URLSearchParams();
    for (const slug of slugs) params.append('tag', slug);
    const query = params.toString();
    return query ? `/tags?${query}` : '/tags';
  }

  function addHref(slug: string): string {
    if (selectedSet.has(slug)) return tagsHref(selectedSlugs);
    return tagsHref([...selectedSlugs, slug]);
  }

  function removeHref(slug: string): string {
    return tagsHref(selectedSlugs.filter((item) => item !== slug));
  }

  let filtersVisible = $state(false);

  onMount(() => {
    filtersVisible = true;
    for (const slug of selectedSlugs) {
      tagsApi.incrementView(slug).catch(() => {});
    }
  });

  $effect(() => {
    void posts;
    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    tick().then(() => {
      if (cancelled) return;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 },
      );
      document
        .querySelectorAll('.post-list-card:not(.visible)')
        .forEach((card) => observer?.observe(card));
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  });
</script>

<svelte:head>
  <title>标签 - YukiLog</title>
  <meta name="description" content="按标签筛选文章，多个标签取交集" />
</svelte:head>

<PageHero title="标签" subtitle="共 {tags.length} 个标签" icon={tagIcon} />

<div class="tags-page">
  <section class="filters" class:visible={filtersVisible}>
    <div class="tray" aria-label="已选标签">
      {#if selectedTags.length === 0}
        <span class="tray-placeholder">已选标签会出现在这里，多个标签取交集</span>
      {:else}
        {#each selectedTags as tag}
          <a
            class="pill on"
            href={removeHref(tag.slug)}
            data-sveltekit-noscroll
            aria-label="取消标签 {tag.name}"
          >
            #{tag.name}
            <span class="pill-x" aria-hidden="true">×</span>
          </a>
        {/each}
        <a class="tray-clear" href="/tags" data-sveltekit-noscroll>清空</a>
      {/if}
    </div>

    {#if poolTags.length > 0}
      <div class="pool" aria-label="可选标签">
        {#each poolTags as tag, i}
          {@const originalIndex = tags.findIndex((item) => item.slug === tag.slug)}
          <a
            class="pill"
            data-color={colorNames[colorCycle[(originalIndex >= 0 ? originalIndex : i) % colorCycle.length]]}
            href={addHref(tag.slug)}
            data-sveltekit-noscroll
            onclick={() => tagsApi.incrementView(tag.slug).catch(() => {})}
          >
            <span class="pill-name">#{tag.name}</span>
            <span class="pill-count">{tag.post_count}</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>

  <p class="result-count">
    {#if selectedTags.length === 0}
      未筛选 · 共 {total} 篇
    {:else}
      同时包含
      {#each selectedTags as tag}
        <span class="result-tag">#{tag.name}</span>
      {/each}
      · {total} 篇
    {/if}
  </p>

  {#if posts.length > 0}
    <div class="post-grid">
      {#each posts as post, i}
        <PostListCard {post} index={i} />
      {/each}
    </div>
  {:else}
    <p class="empty">
      {selectedTags.length > 0 ? '没有同时带这些标签的文章' : '还没有已发布的文章'}
    </p>
  {/if}
</div>

<style>
  .tags-page {
    max-width: 1000px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg) calc(var(--spacing-xxl) * 2);
  }

  .filters {
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 500ms var(--ease-gentle),
      transform 500ms var(--ease-gentle);

    &.visible {
      opacity: 1;
      transform: none;
    }
  }

  .tray {
    min-height: 52px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--pink-alpha-08);
  }

  .tray-placeholder {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .tray-clear {
    margin-left: auto;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color var(--transition-fast) var(--ease-gentle);

    &:hover {
      color: var(--color-pink);
    }
  }

  .pool {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: var(--spacing-md);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1.5px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface, #fff);
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    transition:
      border-color var(--transition-fast) var(--ease-gentle),
      background var(--transition-fast) var(--ease-gentle),
      box-shadow var(--transition-fast) var(--ease-gentle),
      color var(--transition-fast) var(--ease-gentle);

    &:hover {
      color: var(--color-blue);
      border-color: var(--blue-alpha-20);
      background: var(--blue-alpha-08);
    }

    &[data-color='pink'] {
      background: rgba(232, 164, 180, 0.12);
      border-color: rgba(232, 164, 180, 0.2);
      color: var(--color-pink-d18);

      &:hover {
        background: rgba(232, 164, 180, 0.2);
        box-shadow: var(--shadow-pink);
      }
    }

    &[data-color='blue'] {
      background: rgba(126, 182, 217, 0.12);
      border-color: rgba(126, 182, 217, 0.2);
      color: var(--color-blue-d20);

      &:hover {
        background: rgba(126, 182, 217, 0.2);
        box-shadow: var(--shadow-blue);
      }
    }

    &[data-color='white'] {
      background: var(--color-surface, #fff);
      border-color: var(--color-border);
      color: var(--color-text);

      &:hover {
        background: var(--color-white);
        box-shadow: var(--shadow-sm);
      }
    }

    &.on {
      color: var(--color-on-primary, #fff);
      border-color: transparent;
      background: linear-gradient(135deg, var(--color-blue), var(--color-pink));

      &:hover {
        color: var(--color-on-primary, #fff);
        box-shadow: var(--shadow-pink);
      }
    }
  }

  .pill-count {
    font-size: var(--font-size-xs);
    opacity: 0.75;
  }

  .pill-x {
    font-size: 14px;
    line-height: 1;
    opacity: 0.85;
  }

  .result-count {
    margin: 8px 0 16px;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .result-tag {
    margin-left: 6px;
    color: var(--color-pink);
  }

  .post-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
    align-items: start;
  }

  .post-grid :global(.post-list-card) {
    margin-bottom: 0;
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    font-style: italic;
    padding: var(--spacing-xl) 0;
  }

  @media (max-width: 768px) {
    .post-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .tags-page {
      padding: var(--spacing-lg) var(--spacing-sm) var(--spacing-xxl);
    }
  }
</style>
