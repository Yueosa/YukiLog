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

    // 固定侧栏显隐 - 与导航栏 sticky 同步
    const getThreshold = () => window.innerHeight;

    function updateSidebars() {
      const mobileLayout = window.innerWidth <= 1400;
      const threshold = getThreshold();
      const shouldShow = window.scrollY >= threshold - 50;

      const profileCard = document.getElementById('profile-card');
      const hitokotoCard = document.getElementById('hitokoto-card');
      const siteinfoCard = document.getElementById('siteinfo-card');

      if (mobileLayout || shouldShow) {
        profileCard?.classList.add('visible');
        if (!mobileLayout) {
          hitokotoCard?.classList.add('visible');
        } else {
          hitokotoCard?.classList.remove('visible');
        }
        if (siteinfoCard && !siteinfoCard.classList.contains('visible')) {
          setTimeout(() => siteinfoCard.classList.add('visible'), 400);
        }
      } else {
        profileCard?.classList.remove('visible');
        hitokotoCard?.classList.remove('visible');
        siteinfoCard?.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', updateSidebars);
    window.addEventListener('resize', updateSidebars);
    updateSidebars();

    cleanup = () => {
      window.removeEventListener('scroll', updateSidebars);
      window.removeEventListener('resize', updateSidebars);
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

<!-- 固定侧栏卡片（与导航栏同步显隐） -->
<aside class="fixed-sidebar fixed-sidebar-left" id="fixed-sidebar-left">
  <ProfileCard />
</aside>

<div class="home-second-screen" id="second-screen">
  <ArticleList posts={data.recentPosts} currentSort={data.currentSort} />
</div>

<aside class="fixed-sidebar fixed-sidebar-right" id="fixed-sidebar-right">
  <HitokotoCard />
  <SiteInfoCard stats={data.stats} />
</aside>

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

  :root {
    --sidebar-width: clamp(240px, 18vw, 280px);
    --sidebar-offset: clamp(12px, 1.5vw, 24px);
    --sidebar-gap: 28px;
    --sidebar-total: calc(var(--sidebar-width) + var(--sidebar-offset) + var(--sidebar-gap));
    --layout-max-width: 1920px;
  }

  .home-second-screen {
    width: 100%;
    max-width: var(--layout-max-width);
    min-height: 100vh;
    background: var(--color-bg);
    margin: 0 auto;
    padding-left: var(--sidebar-total);
    padding-right: var(--sidebar-total);
  }

  .fixed-sidebar {
    position: fixed;
    top: 70px;
    width: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    z-index: 99;
    pointer-events: none;

    :global(> *) {
      pointer-events: auto;
    }
  }

  .fixed-sidebar-left {
    left: max(var(--sidebar-offset), calc((100vw - var(--layout-max-width)) / 2 + var(--sidebar-offset)));
  }

  .fixed-sidebar-right {
    right: max(var(--sidebar-offset), calc((100vw - var(--layout-max-width)) / 2 + var(--sidebar-offset)));
  }

  @media (max-width: 1400px) {
    .home-second-screen {
      padding-left: 0;
      padding-right: 0;
    }

    .fixed-sidebar {
      position: static;
      top: auto;
      left: auto;
      right: auto;
      width: min(100%, 800px);
      margin: 0 auto;
      padding: 0 var(--spacing-md);
      z-index: auto;
      pointer-events: auto;
    }

    .fixed-sidebar-left {
      margin-top: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);
    }

    .fixed-sidebar-right {
      margin-top: 0;
      margin-bottom: var(--spacing-xl);
    }

    .fixed-sidebar-right :global(#hitokoto-card) {
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
