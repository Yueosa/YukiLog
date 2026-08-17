<script lang="ts">
  import { onMount } from 'svelte';
  import PageHero from '../../components/shared/PageHero.svelte';
  import { notesApi } from '$lib/api';
  import { contentConfig } from '$lib/config';
  import { renderMarkdownPreview } from '$lib/markdown';
  import { navIcons } from '$lib/svg-icons';
  import type { Note } from '$types/api';

  let { data } = $props();

  const notesPageConfig = contentConfig.pages.notes;
  const moodLabels: Record<string, string> = notesPageConfig.moodLabels;

  type NoteWithHtml = Note & { renderedContent: string };

  let notes: NoteWithHtml[] = $state([...data.notes]);
  let currentPage = $state(1);
  let isLoading = $state(false);
  let allLoaded = $state(data.totalPages <= 1);
  let isNarrow = $state(false);

  function estimateHeight(note: NoteWithHtml) {
    const text = Math.min(note.content.length, 200);
    const image = /!\[[^\]]*]\([^)]+\)/.test(note.content) ? 140 : 0;
    return 72 + image + Math.ceil(text / 18) * 22 + (note.content.length > 200 ? 24 : 0);
  }

  function splitMasonry(list: NoteWithHtml[]) {
    const columns: [{ note: NoteWithHtml; index: number }[], { note: NoteWithHtml; index: number }[]] = [[], []];
    const heights = [0, 0];
    list.forEach((note, index) => {
      const side = heights[0] <= heights[1] ? 0 : 1;
      columns[side].push({ note, index });
      heights[side] += estimateHeight(note);
    });
    return columns;
  }

  const masonryCols = $derived(splitMasonry(notes));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function loadMore() {
    if (isLoading || allLoaded) return;
    isLoading = true;
    currentPage += 1;

    try {
      const response = await notesApi.list({
        page: currentPage,
        page_size: data.pageSize,
      });
      const items = response.items || [];

      if (items.length > 0) {
        const newNotes: NoteWithHtml[] = items.map((note) => ({
          ...note,
          renderedContent: renderMarkdownPreview(note.content),
        }));
        notes = [...notes, ...newNotes];
      }

      if (currentPage >= data.totalPages) {
        allLoaded = true;
      }
    } catch (err) {
      console.error('加载随记失败:', err);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const syncNarrow = () => {
      isNarrow = mq.matches;
    };
    syncNarrow();
    mq.addEventListener('change', syncNarrow);

    let observer: IntersectionObserver | undefined;
    if (!allLoaded) {
      const loader = document.getElementById('notes-loader');
      if (loader) {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              loadMore();
            }
          },
          { rootMargin: '200px' },
        );
        observer.observe(loader);
      }
    }

    return () => {
      mq.removeEventListener('change', syncNarrow);
      observer?.disconnect();
    };
  });
</script>

<svelte:head>
  <title>随记 - YukiLog</title>
  <meta name="description" content="记录碎片化的想法与日常" />
</svelte:head>

<PageHero title="随记" subtitle={notesPageConfig.heroSubtitle} icon={navIcons.notes} />

<div class="notes-page">
  {#if notes.length === 0}
    <div class="notes-empty">
      <p>{notesPageConfig.emptyText}</p>
    </div>
  {:else}
    {#snippet noteCard(note: NoteWithHtml, i: number)}
      <a
        href="/notes/{note.id}"
        class="note-card"
        class:alt={i % 2 === 1}
        style="animation-delay: {Math.min(i % 12, 8) * 40}ms"
      >
        <div class="note-meta">
          <time class="note-time" datetime={note.created_at}>{formatDate(note.created_at)}</time>
          {#if note.mood}
            <span class="note-mood">{moodLabels[note.mood] || note.mood}</span>
          {/if}
        </div>
        <div class="note-body markdown-content">{@html note.renderedContent}</div>
        {#if note.content.length > 200}
          <span class="note-more">更多</span>
        {/if}
      </a>
    {/snippet}

    <div class="notes-feed" class:masonry={!isNarrow}>
      {#if isNarrow}
        {#each notes as note, i}
          {@render noteCard(note, i)}
        {/each}
      {:else}
        <div class="notes-col">
          {#each masonryCols[0] as item}
            {@render noteCard(item.note, item.index)}
          {/each}
        </div>
        <div class="notes-col">
          {#each masonryCols[1] as item}
            {@render noteCard(item.note, item.index)}
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if !allLoaded}
    <div class="notes-loader" id="notes-loader">
      <div class="loader-spinner"></div>
      <p class="loader-text">{isLoading ? notesPageConfig.loadingText : ''}</p>
    </div>
  {/if}

  {#if allLoaded}
    <div class="notes-end">
      <p>{notesPageConfig.loadMoreText}</p>
    </div>
  {/if}
</div>

<style>
  .notes-page {
    max-width: 1080px;
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-lg) var(--spacing-xxl);
  }

  .notes-empty {
    text-align: center;
    padding: var(--spacing-xxl) 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-lg);
  }

  .notes-feed {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .notes-feed.masonry {
    flex-direction: row;
    align-items: flex-start;
  }

  .notes-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .note-card {
    display: block;
    background: var(--color-white);
    border-radius: 16px;
    padding: 14px 16px 16px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
    text-decoration: none;
    opacity: 0;
    transform: translateY(12px);
    animation: note-enter 400ms var(--ease-gentle) forwards;
    transition: box-shadow 300ms var(--ease-gentle), border-color 300ms var(--ease-gentle);

    &:hover {
      box-shadow: var(--shadow-blue-md);
      border-color: var(--blue-alpha-20);
    }

    &.alt:hover {
      box-shadow: var(--shadow-pink-md);
      border-color: var(--pink-alpha-20);
    }
  }

  @keyframes note-enter {
    to {
      opacity: 1;
      transform: none;
    }
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .note-time {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    font-family: var(--font-family-code);
  }

  .note-mood {
    font-size: 11px;
    padding: 1px 8px;
    background: linear-gradient(135deg, var(--blue-alpha-08), var(--pink-alpha-08));
    border-radius: 999px;
    color: var(--color-text-light);
  }

  .note-body {
    font-size: 0.9375rem;
    color: var(--color-text);
    line-height: 1.65;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;

    :global(p) {
      margin: 0 0 0.4em;
    }

    :global(p:last-child) {
      margin-bottom: 0;
    }

    :global(pre),
    :global(.code-block) {
      font-size: var(--font-size-xs);
      max-height: 88px;
      overflow: hidden;
    }

    :global(img) {
      display: block;
      max-width: 100%;
      max-height: 140px;
      object-fit: cover;
      border-radius: 10px;
      margin: 6px 0;
    }
  }

  .note-more {
    display: inline-block;
    margin-top: 8px;
    font-size: var(--font-size-xs);
    color: var(--color-blue);
  }

  .note-card.alt:hover .note-more {
    color: var(--color-pink);
  }

  .notes-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xl) 0;
    gap: var(--spacing-sm);
  }

  .loader-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-blue);
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loader-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .notes-end {
    text-align: center;
    padding: var(--spacing-xl) 0;

    p {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
    }
  }

  @media (max-width: 640px) {
    .notes-page {
      padding: var(--spacing-lg) var(--spacing-sm) var(--spacing-xxl);
    }
  }
</style>
