<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { svgIcons } from '$lib/svg-icons';
  import { contentConfig } from '$lib/config';
  import { postsApi } from '$lib/api';
  import { splitHighlights } from '$lib/sanitize';
  import { formatDate } from '$lib/date';
  import type { PostWithRelations } from '$types';

  const sc = contentConfig.components.search;

  let overlay: HTMLElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let isOpen = $state(false);
  let view = $state<'hint' | 'loading' | 'empty' | 'results'>('hint');
  let activeIndex = $state(-1);
  let currentPage = $state(1);
  let currentQuery = $state('');
  let items = $state<PostWithRelations[]>([]);
  let totalPages = $state(0);
  let total = $state(0);

  const PAGE_SIZE = 8;

  function openSearch() {
    isOpen = true;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => input?.focus());
  }

  function closeSearch() {
    isOpen = false;
    document.body.style.overflow = '';
    if (input) input.value = '';
    currentQuery = '';
    currentPage = 1;
    activeIndex = -1;
    items = [];
    view = 'hint';
  }

  function handleResultClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    closeSearch();
  }

  afterNavigate(() => {
    if (isOpen) closeSearch();
  });

  async function doSearch(query: string, page: number) {
    if (!query.trim()) {
      view = 'hint';
      return;
    }

    view = 'loading';
    currentQuery = query;
    currentPage = page;

    try {
      const data = await postsApi.search({ q: query, page, page_size: PAGE_SIZE });

      if (data.items.length === 0) {
        view = 'empty';
        return;
      }

      items = data.items;
      totalPages = data.total_pages;
      total = data.total;
      view = 'results';
      activeIndex = -1;
    } catch {
      view = 'empty';
    }
  }

  function handleInput(e: Event) {
    const q = (e.target as HTMLInputElement).value.trim();
    if (!q) {
      view = 'hint';
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(q, 1), 300);
  }

  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleKeydown(e: KeyboardEvent) {
    const count = items.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (count > 0) {
          activeIndex = (activeIndex + 1) % count;
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (count > 0) {
          activeIndex = activeIndex <= 0 ? count - 1 : activeIndex - 1;
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < count) {
          const post = items[activeIndex].post;
          closeSearch();
          goto(`/posts/${post.slug}`);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSearch();
        break;
    }
  }

  onMount(() => {
    const onGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? closeSearch() : openSearch();
      }
      if (e.key === 'Escape' && isOpen) {
        closeSearch();
      }
    };

    document.addEventListener('keydown', onGlobalKeydown);

    // 绑定搜索按钮
    const searchToggle = document.getElementById('search-toggle');
    searchToggle?.addEventListener('click', openSearch);

    // 绑定 navbar 内搜索按钮
    document.querySelectorAll('.navbar-inner-actions .navbar-action-btn[aria-label="搜索"]').forEach(btn => {
      btn.addEventListener('click', openSearch);
    });

    return () => {
      document.removeEventListener('keydown', onGlobalKeydown);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="search-overlay"
  class:active={isOpen}
  bind:this={overlay}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-backdrop" onclick={closeSearch} onkeydown={() => {}}></div>

  <div class="search-panel">
    <div class="search-header">
      <div class="search-input-wrapper">
        <span class="search-input-icon">{@html svgIcons.search}</span>
        <input
          type="text"
          class="search-input"
          placeholder={sc.placeholder}
          autocomplete="off"
          spellcheck="false"
          bind:this={input}
          oninput={handleInput}
          onkeydown={handleKeydown}
        />
        <kbd class="search-kbd">ESC</kbd>
      </div>
    </div>

    <div class="search-body">
      {#if view === 'hint'}
        <div class="search-hint">
          <p>{sc.hint}</p>
          <div class="search-hint-shortcuts">
            <span><kbd>↑</kbd><kbd>↓</kbd> {sc.keyboard.navigate}</span>
            <span><kbd>Enter</kbd> {sc.keyboard.open}</span>
            <span><kbd>ESC</kbd> {sc.keyboard.close}</span>
          </div>
        </div>
      {:else if view === 'loading'}
        <div class="search-loading">
          <div class="search-spinner"></div>
          <p>{sc.loading}</p>
        </div>
      {:else if view === 'empty'}
        <div class="search-empty">
          <p>{sc.noResult}</p>
        </div>
      {:else if view === 'results'}
        <div class="search-results">
          <ul class="search-result-list">
            {#each items as item, i}
              <li class="search-result-item" class:active={i === activeIndex}>
                <a href="/posts/{item.post.slug}" onclick={handleResultClick}>
                  <div class="search-result-title">
                    {#each splitHighlights(item.post.title) as part}
                      {#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}
                    {/each}
                  </div>
                  {#if item.post.summary || item.post.content}
                    <div class="search-result-excerpt">
                      {#each splitHighlights(item.post.summary || item.post.content) as part}
                        {#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}
                      {/each}
                    </div>
                  {/if}
                  <div class="search-result-meta">
                    <time>{formatDate(item.post.created_at)}</time>
                    {#each item.tags as tag}
                      <span class="search-result-tag">#{tag.name}</span>
                    {/each}
                  </div>
                </a>
              </li>
            {/each}
          </ul>

          {#if totalPages > 1}
            <div class="search-pagination">
              <button
                class="search-page-btn"
                disabled={currentPage <= 1}
                onclick={() => doSearch(currentQuery, currentPage - 1)}
              >{sc.prevPage}</button>
              <span class="search-page-info">{currentPage} / {totalPages}（共 {total} 篇）</span>
              <button
                class="search-page-btn"
                disabled={currentPage >= totalPages}
                onclick={() => doSearch(currentQuery, currentPage + 1)}
              >{sc.nextPage}</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .search-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    opacity: 0;
    visibility: hidden;
    transition: opacity var(--transition-base) var(--ease-gentle),
                visibility var(--transition-base) var(--ease-gentle);

    &.active {
      opacity: 1;
      visibility: visible;

      .search-panel {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
  }

  .search-backdrop {
    position: absolute;
    inset: 0;
    background: var(--overlay-bg);
    backdrop-filter: blur(8px);
  }

  .search-panel {
    position: relative;
    width: 90%;
    max-width: 680px;
    max-height: 70vh;
    background: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 60px var(--shadow-2xl),
                0 0 0 1px var(--blue-alpha-10);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateY(-20px) scale(0.95);
    opacity: 0;
    transition: transform var(--transition-base) var(--ease-gentle),
                opacity var(--transition-base) var(--ease-gentle);
  }

  .search-header {
    padding: var(--spacing-md) var(--spacing-lg);
    background: linear-gradient(135deg, var(--blue-alpha-02) 0%, var(--pink-alpha-02) 100%);
    border-bottom: 2px solid var(--blue-alpha-08);
    flex-shrink: 0;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-white);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-sm);
    transition: all var(--transition-base) var(--ease-gentle);

    &:focus-within {
      border-color: var(--color-blue);
      box-shadow: 0 0 0 4px var(--blue-alpha-10);
      transform: translateY(-2px);
    }
  }

  .search-input-icon {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-pink) 100%);
    -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
    mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
    -webkit-mask-size: contain;
    mask-size: contain;
    display: flex;
    align-items: center;
    justify-content: center;

    :global(svg) {
      display: none;
    }
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    font-size: var(--font-size-base);
    color: var(--color-text);
    font-family: var(--font-family-base);
    padding: 0;

    &::placeholder {
      color: var(--color-text-muted);
    }
  }

  .search-kbd {
    flex-shrink: 0;
    padding: 3px 10px;
    font-size: var(--font-size-xs);
    font-family: var(--font-family-code);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    background: var(--gradient-blue-pink);
    border: 1px solid var(--blue-alpha-20);
    border-radius: 6px;
    line-height: 1.4;
    box-shadow: 0 1px 3px var(--shadow-xs);
  }

  .search-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 2px;
    }
  }

  .search-hint,
  .search-loading,
  .search-empty {
    padding: var(--spacing-xl) 0;
    text-align: center;
    color: var(--color-text-muted);

    p {
      margin: 0;
      font-size: var(--font-size-sm);
    }
  }

  .search-hint-shortcuts {
    display: flex;
    justify-content: center;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--color-text);

    kbd {
      padding: 3px 8px;
      font-family: var(--font-family-code);
      font-weight: var(--font-weight-medium);
      background: var(--gradient-blue-pink);
      border: 1px solid var(--blue-alpha-20);
      border-radius: 4px;
      font-size: var(--font-size-xs);
      margin: 0 3px;
      box-shadow: 0 1px 3px var(--shadow-xs);
    }
  }

  .search-spinner {
    width: 32px;
    height: 32px;
    margin: 0 auto var(--spacing-md);
    border: 3px solid var(--border-alpha-30);
    border-top-color: var(--color-blue);
    border-right-color: var(--color-pink);
    border-radius: 50%;
    animation: search-spin 600ms linear infinite;
  }

  @keyframes search-spin {
    to { transform: rotate(360deg); }
  }

  .search-result-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .search-result-item {
    background: var(--color-white);
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-sm);
    transition: all var(--transition-base) var(--ease-gentle);
    box-shadow: 0 1px 3px var(--shadow-xs);

    &.active,
    &:hover {
      background: linear-gradient(135deg, var(--blue-alpha-03) 0%, var(--pink-alpha-03) 100%);
      border-color: var(--blue-alpha-20);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px var(--blue-alpha-15);
    }

    a {
      display: block;
      padding: var(--spacing-md) var(--spacing-lg);
      text-decoration: none;
      color: inherit;
    }
  }

  .search-result-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin: 0 0 var(--spacing-sm);
    line-height: var(--line-height-tight);

    :global(mark) {
      background: linear-gradient(135deg, var(--blue-alpha-15) 0%, var(--pink-alpha-15) 100%);
      color: var(--color-blue);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: var(--font-weight-bold);
      border: 1px solid var(--blue-alpha-20);
    }
  }

  .search-result-excerpt {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: var(--line-height-relaxed);
    margin: 0 0 var(--spacing-sm);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    :global(mark) {
      background: linear-gradient(135deg, var(--pink-alpha-12) 0%, var(--pink-alpha-18) 100%);
      color: var(--color-pink);
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: var(--font-weight-medium);
    }
  }

  .search-result-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .search-result-tag {
    display: inline-block;
    padding: 2px 10px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-pink);
    background: linear-gradient(135deg, var(--pink-alpha-08) 0%, var(--pink-alpha-12) 100%);
    border: 1px solid var(--pink-alpha-20);
    border-radius: 12px;
    transition: all var(--transition-fast) var(--ease-gentle);

    &:hover {
      background: linear-gradient(135deg, var(--pink-alpha-15) 0%, var(--pink-alpha-20) 100%);
      transform: scale(1.05);
    }
  }

  .search-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-sm);
  }

  .search-page-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-on-primary);
    background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-pink) 100%);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-base) var(--ease-gentle);
    box-shadow: var(--shadow-blue-sm);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-blue-lg);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
  }

  .search-page-info {
    font-size: var(--font-size-sm);
    color: var(--color-text);
    font-family: var(--font-family-code);
    font-weight: var(--font-weight-medium);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--gradient-blue-pink);
    border-radius: var(--radius-sm);
  }

  @media (max-width: 640px) {
    .search-overlay {
      padding-top: 6vh;
    }

    .search-panel {
      width: 95%;
      max-height: 80vh;
    }

    .search-hint-shortcuts {
      flex-direction: column;
      gap: var(--spacing-xs);
    }
  }
</style>
