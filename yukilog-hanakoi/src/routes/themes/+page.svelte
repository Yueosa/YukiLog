<script lang="ts">
  import { onMount } from 'svelte';
  import PageHero from '../../components/shared/PageHero.svelte';
  import { contentConfig } from '$lib/config';
  import { navIcons } from '$lib/svg-icons';

  const themeIcon = navIcons.theme;
  const themesPageConfig = contentConfig.pages.themes;

  let { data } = $props();
  let themes = $derived(data.themes);

  // 确定性微旋转角度
  const rotations = [1.2, -1.8, 2.1, -0.9, 1.6, -2.3, 0.7, -1.4];
  const offsets = [0, 24, -16, 32, -8, 20, -28, 12];

  onMount(() => {
    const cards = document.querySelectorAll<HTMLElement>('.theme-card');
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const i = parseInt(el.style.getPropertyValue('--i') || '0');
            setTimeout(() => el.classList.add('visible'), i * 80);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <title>主题 - YukiLog</title>
  <meta name="description" content="按主题分类浏览所有文章" />
</svelte:head>

<PageHero title="主题" subtitle={themesPageConfig.heroSubtitle} icon={themeIcon} />

<div class="themes-page">
  <div class="themes-scatter">
    {#each themes as theme, i}
      <a
        href="/themes/{theme.slug}"
        class="theme-card"
        style="--i: {i}; --rot: {rotations[i % rotations.length]}deg; --offset: {offsets[i % offsets.length]}px"
      >
        <div class="theme-card-inner">
          <h2 class="theme-name">{theme.name}</h2>
          {#if theme.description}
            <p class="theme-desc">{theme.description}</p>
          {/if}
          <div class="theme-meta">
            <span class="theme-count">{theme.post_count} {themesPageConfig.postCountSuffix}</span>
            <span class="theme-arrow">→</span>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>

<style>
  .themes-page {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg) var(--spacing-xxl);
  }

  .themes-scatter {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-lg) var(--spacing-md);
    padding: 0 var(--spacing-md);
  }

  .theme-card {
    display: block;
    text-decoration: none;
    border-radius: var(--radius-lg);
    background: var(--color-white);
    overflow: hidden;
    width: calc(50% - var(--spacing-md));
    transform: rotate(var(--rot)) translateX(var(--offset));
    transition:
      box-shadow var(--transition-base) var(--ease-gentle),
      transform var(--transition-base) var(--ease-gentle);
    opacity: 0;

    &:nth-child(odd) {
      box-shadow: var(--shadow-blue);
      border-left: 3px solid var(--color-blue);
      &:hover { box-shadow: var(--shadow-blue-offset-hover); }
    }

    &:nth-child(even) {
      box-shadow: var(--shadow-pink);
      border-left: 3px solid var(--color-pink);
      &:hover { box-shadow: var(--shadow-pink-offset-hover); }
    }

    &:nth-child(3n+1) { width: calc(48% - var(--spacing-md)); }
    &:nth-child(3n+2) { width: calc(44% - var(--spacing-md)); }
    &:nth-child(3n)   { width: calc(52% - var(--spacing-md)); }

    &:hover {
      transform: rotate(0deg) translateX(0) translateY(-6px);
      z-index: 2;

      .theme-arrow {
        transform: translateX(4px);
        opacity: 1;
      }
    }
  }

  :global(.theme-card.visible) {
    opacity: 1;
    transform: rotate(var(--rot)) translateX(var(--offset));
    transition:
      opacity 500ms var(--ease-gentle),
      transform var(--transition-base) var(--ease-gentle),
      box-shadow var(--transition-base) var(--ease-gentle);
  }

  :global(.theme-card.visible:hover) {
    transform: rotate(0deg) translateX(0) translateY(-6px);
  }

  .theme-card-inner {
    padding: var(--spacing-lg) var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-height: 130px;
    justify-content: space-between;
  }

  .theme-name {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin: 0;
    line-height: var(--line-height-tight);
  }

  .theme-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: var(--line-height-base);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .theme-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--spacing-xs);
  }

  .theme-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .theme-arrow {
    font-size: var(--font-size-lg);
    color: var(--color-text-muted);
    transition: transform var(--transition-fast) var(--ease-gentle), opacity var(--transition-fast);
    opacity: 0.5;
  }

  @media (max-width: 640px) {
    .themes-page {
      padding: var(--spacing-lg) var(--spacing-sm) var(--spacing-xxl);
    }

    .theme-card,
    .theme-card:nth-child(3n+1),
    .theme-card:nth-child(3n+2),
    .theme-card:nth-child(3n) {
      width: 100%;
    }
  }
</style>
