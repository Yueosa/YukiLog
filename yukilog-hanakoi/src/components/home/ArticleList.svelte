<script lang="ts">
  import { onMount } from 'svelte';
  import ArticleCard from './ArticleCard.svelte';
  import type { PostCardData } from '$types/blog';
  import { contentConfig } from '$lib/config';

  interface Props {
    posts: PostCardData[];
    currentSort: 'created_at' | 'updated_at' | 'view_count';
  }

  let { posts, currentSort }: Props = $props();

  const sortOptions = [
    { key: 'created_at' as const, label: '最新' },
    { key: 'view_count' as const, label: '最热' },
    { key: 'updated_at' as const, label: '最近更新' },
  ];

  const sortLabel = $derived(currentSort === 'view_count' ? '最热' : currentSort === 'updated_at' ? '最近更新' : '最新');

  onMount(() => {
    const articleCards = document.querySelectorAll('.article-card');
    if (!articleCards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            const index = parseInt(card.dataset.index || '0', 10);
            const delay = index * 120;
            setTimeout(() => {
              card.classList.add('visible');
            }, delay);
            observer.unobserve(card);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    articleCards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  });
</script>

<section class="article-list-section" id="article-list">
  <div class="article-list-header">
    <h2 class="article-list-title">
      精选 · {sortLabel}
      {' '}{posts.length} 篇博客
    </h2>
    <div class="sort-pills">
      {#each sortOptions as opt}
        <a
          href={opt.key === 'created_at' ? '/#article-list' : `/?sort=${opt.key}#article-list`}
          class="sort-pill"
          class:active={currentSort === opt.key}
          data-sveltekit-preload-data
        >
          {opt.label}
        </a>
      {/each}
    </div>
  </div>
  <div class="article-list-container">
    {#each posts as post, i}
      <ArticleCard {post} index={i} />
    {/each}
  </div>

  <div class="load-more">
    <span class="load-more-text">{contentConfig.pages.home.articleList.loadMoreText}</span>
  </div>
</section>

<style>
  .article-list-section {
    width: 100%;
    padding-bottom: var(--spacing-xxl);
  }

  .article-list-header {
    width: 100%;
    margin: 0 auto;
    padding: 0 0 var(--spacing-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .article-list-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-light);
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .sort-pills {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .sort-pill {
    padding: 4px 14px;
    border-radius: 20px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
    background: transparent;
    border: 1.5px solid transparent;
    text-decoration: none;
    transition: all 0.25s ease;
    letter-spacing: 0.04em;
    cursor: pointer;

    &:hover {
      color: var(--color-blue);
      background: var(--blue-alpha-06);
      border-color: var(--blue-alpha-15);
    }

    &.active {
      color: var(--color-pink);
      background: var(--pink-alpha-08);
      border-color: var(--pink-alpha-20);
    }
  }

  .article-list-container {
    width: 100%;
    margin: 0 auto;
    padding: var(--spacing-lg) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .load-more {
    display: flex;
    justify-content: center;
    padding: var(--spacing-xxl) 0 var(--spacing-lg);
  }

  .load-more-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    letter-spacing: 0.1em;
  }

  @media (max-width: 1024px) {
    .article-list-header {
      flex-wrap: wrap;
    }
  }
</style>
