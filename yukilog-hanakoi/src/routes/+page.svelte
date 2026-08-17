<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WelcomeCard from '../components/home/WelcomeCard.svelte';
  import ProfileCard from '../components/home/ProfileCard.svelte';
  import HitokotoCard from '../components/home/HitokotoCard.svelte';
  import SiteInfoCard from '../components/home/SiteInfoCard.svelte';
  import ArticleList from '../components/home/ArticleList.svelte';
  import { uiIcons } from '$lib/svg-icons';
  import { siteConfig } from '$lib/config';

  let { data } = $props();

  // 随机选择一张背景图（static/ 目录，不经过 Vite 处理）
  const backgrounds = [
    '/images/background/wallhaven-3l2vm3.jpg',
    '/images/background/wallhaven-858k3j.jpg',
    '/images/background/wallhaven-yxoejx.jpg',
  ];
  const randomBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];

  let cleanup: (() => void) | undefined;

  onMount(() => {
    const btn = document.getElementById('scroll-arrow');
    const target = document.getElementById('second-screen');
    if (btn && target) {
      const handleClick = () => target.scrollIntoView({ behavior: 'smooth' });
      btn.addEventListener('click', handleClick);
    }

    const profileCard = document.getElementById('profile-card');
    const hitokotoCard = document.getElementById('hitokoto-card');
    const siteinfoCard = document.getElementById('siteinfo-card');

    const observer = target
      ? new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            profileCard?.classList.add('visible');
            hitokotoCard?.classList.add('visible');
            if (siteinfoCard && !siteinfoCard.classList.contains('visible')) {
              setTimeout(() => siteinfoCard.classList.add('visible'), 400);
            }
          },
          { threshold: 0.08 },
        )
      : null;

    if (target) observer?.observe(target);

    cleanup = () => {
      observer?.disconnect();
    };
  });

  onDestroy(() => {
    cleanup?.();
  });
</script>

<svelte:head>
  <title>{siteConfig.name}</title>
  <meta name="description" content={siteConfig.description} />
</svelte:head>

<div class="home-first-screen">
  <div
    class="home-bg"
    style="background-image: url({randomBackground})"
  ></div>
  <WelcomeCard />

  <button class="scroll-arrow" id="scroll-arrow" aria-label="滚动到下一屏">
    {@html uiIcons.arrow}
  </button>
</div>

<div class="home-second-screen" id="second-screen">
  <aside class="home-rail home-rail-left">
    <ProfileCard />
  </aside>

  <div class="home-main">
    <ArticleList posts={data.recentPosts} currentSort={data.currentSort} />
  </div>

  <aside class="home-rail home-rail-right">
    <HitokotoCard />
    <SiteInfoCard stats={data.stats} />
  </aside>
</div>

<style>
  .home-first-screen {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .home-bg {
    position: absolute;
    inset: 0;
    background-color: var(--color-surface-dark, #0a0a0a);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    animation: bg-fade-in 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
    filter: brightness(0.3) blur(8px);
    z-index: 0;
  }

  @keyframes bg-fade-in {
    from {
      filter: brightness(0.3) blur(8px);
    }
    to {
      filter: brightness(0.7) blur(0);
    }
  }

  .scroll-arrow {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: var(--color-on-primary-alpha-70, rgba(255, 255, 255, 0.7));
    animation: arrow-float 2.5s ease-in-out infinite;
    transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);

    :global(svg) {
      width: 36px;
      height: 36px;
      fill: currentColor;
    }

    &:hover {
      color: var(--color-on-primary-alpha-95, rgba(255, 255, 255, 0.95));
      animation: arrow-float 2.5s ease-in-out infinite;
      transform: translateX(-50%) scale(1.25);
    }
  }

  @keyframes arrow-float {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 10px; }
  }

  .home-second-screen {
    --home-rail: clamp(240px, 16vw, 280px);
    --home-gap: 28px;
    --home-inset: clamp(16px, 2vw, 32px);

    display: grid;
    grid-template-columns: var(--home-rail) minmax(0, 1fr) var(--home-rail);
    column-gap: var(--home-gap);
    width: 100%;
    min-height: 100vh;
    margin: 0;
    padding: 70px var(--home-inset) 0;
    background: var(--color-bg);
  }

  .home-rail {
    position: sticky;
    top: 70px;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    min-width: 0;
  }

  .home-main {
    min-width: 0;
  }

  @media (max-width: 1200px) {
    .home-second-screen {
      grid-template-columns: minmax(0, 1fr);
      row-gap: var(--spacing-lg);
      padding: var(--spacing-lg) var(--spacing-md) var(--spacing-xl);
    }

    .home-rail {
      position: static;
      width: min(100%, 800px);
      margin: 0 auto;
    }

    .home-rail-left {
      order: 0;
    }

    .home-main {
      order: 1;
    }

    .home-rail-right {
      order: 2;
    }

    .home-rail-right :global(#hitokoto-card) {
      display: none;
    }

    :global(#profile-card),
    :global(#hitokoto-card),
    :global(#siteinfo-card) {
      opacity: 1 !important;
      transform: translateX(0) !important;
    }
  }
</style>
