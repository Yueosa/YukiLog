<script lang="ts">
  import { onMount } from 'svelte';
  import { contentConfig } from '$lib/config';

  const scrollConfig = contentConfig.components.scrollProgress;

  let visible = $state(false);
  let progress = $state(0);
  let percent = $state(0);

  onMount(() => {
    let ticking = false;

    function updateProgress() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (docHeight <= 0) {
        progress = 0;
        percent = 0;
        visible = false;
        ticking = false;
        return;
      }

      const next = Math.min(scrollTop / docHeight, 1);
      progress = next;
      percent = Math.round(next * 100);
      visible = scrollTop > 200;
      ticking = false;
    }

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateProgress);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  });
</script>

<div class="scroll-progress-bar" style="--p: {progress}" aria-hidden="true"></div>

<button
  class="back-to-top"
  class:visible
  style="--p: {progress}"
  onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
  aria-label={scrollConfig.backToTop}
  title={scrollConfig.backToTop}
>
  <span class="btt-track" aria-hidden="true"></span>
  <span class="btt-percent">{percent}%</span>
</button>

<style>
  .scroll-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: transparent;
    z-index: 201;
    pointer-events: none;

    &::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        var(--color-pink) 20%,
        var(--color-pink) 80%,
        transparent
      );
      transform: scaleX(var(--p, 0));
      transform-origin: center;
    }
  }

  .back-to-top {
    position: fixed;
    right: var(--spacing-lg);
    bottom: var(--spacing-lg);
    z-index: var(--z-modal);

    display: flex;
    align-items: stretch;
    width: 168px;
    height: 36px;
    padding: 0;
    overflow: hidden;

    background: var(--white-alpha-85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    box-shadow: var(--shadow-pink);

    color: var(--color-text);
    cursor: pointer;

    opacity: 0;
    transform: translateY(16px);
    pointer-events: none;
    transition:
      opacity 300ms var(--ease-gentle),
      transform 300ms var(--ease-gentle),
      box-shadow 200ms var(--ease-gentle),
      border-color 200ms var(--ease-gentle);

    &.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    &:hover {
      box-shadow: var(--shadow-pink-offset-hover);
      border-color: var(--color-pink);
    }

    &:active {
      transform: scale(0.97);
    }
  }

  .btt-track {
    flex: 0 0 70%;
    position: relative;
    background: var(--color-bg);

    &::after {
      content: "";
      position: absolute;
      top: 6px;
      bottom: 6px;
      left: 8px;
      right: 8px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--color-blue), var(--color-pink));
      transform: scaleX(var(--p, 0));
      transform-origin: left center;
      transition: transform 80ms linear;
    }
  }

  .btt-percent {
    flex: 0 0 30%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: var(--font-weight-semibold);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: var(--color-text);
  }

  @media (max-width: 768px) {
    .back-to-top {
      right: var(--spacing-md);
      bottom: var(--spacing-md);
      width: 148px;
      height: 32px;
    }

    .btt-percent {
      font-size: 11px;
    }
  }
</style>
