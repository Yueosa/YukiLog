<script lang="ts">
  import { svgIcons } from '$lib/svg-icons';
  import type { PostCardData } from '$types/blog';

  interface Props {
    post: PostCardData;
    index: number;
  }

  let { post, index }: Props = $props();
  const isReversed = $derived(index % 2 === 1);

  const placeholderCover = '/images/placeholder-cover.jpg';
  const coverSrc = $derived(post.cover_image || placeholderCover);
</script>

<article class="article-card" class:reversed={isReversed} data-index={index}>
  <a href={`/posts/${post.slug}`} class="article-cover" aria-label={`阅读 ${post.title}`}>
    <div class="cover-inner">
      <img src={coverSrc} alt={post.title} loading="lazy" />
    </div>
  </a>

  <div class="article-info">
    <div class="article-header">
      <a href={`/posts/${post.slug}`} class="article-title">{post.title}</a>
      {#if post.summary}
        <p class="article-summary">{post.summary}</p>
      {/if}
      <time class="article-date" datetime={post.created_at}>
        {new Date(post.created_at).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </time>
    </div>

    <div class="article-meta">
      {#if post.theme}
        <a href={`/themes/${post.theme.slug}`} class="article-theme">
          <span class="article-theme-icon">{@html svgIcons.folderOpen}</span>
          {post.theme.name}
        </a>
      {/if}
      {#if post.tags && post.tags.length > 0}
        <div class="article-tags">
          {#each post.tags.slice(0, 3) as tag}
            <a href={`/tags?tag=${tag.slug}`} class="tag-pill">
              <span class="tag-hash">#</span>{tag.name}
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</article>

<style>
  .article-card {
    display: grid;
    grid-template-columns: 4fr 6fr;
    gap: 0;
    background: var(--color-white);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-blue);

    opacity: 0;
    transform: translateY(40px);
    transition:
      opacity 600ms var(--ease-gentle),
      transform 600ms var(--ease-gentle),
      box-shadow var(--transition-base) var(--ease-gentle);

    &:global(.visible) {
      opacity: 1;
      transform: none;
    }

    &:hover {
      box-shadow: var(--shadow-blue-offset-hover);
    }

    &.reversed {
      grid-template-columns: 6fr 4fr;

      .article-cover {
        order: 2;
      }

      .article-info {
        order: 1;
      }
    }
  }

  .article-cover {
    display: block;
    overflow: hidden;
    position: relative;
    min-height: 240px;

    .cover-inner {
      width: 100%;
      overflow: hidden;
    }

    img {
      display: block;
      width: 100%;
      height: auto;
      min-height: 240px;
      object-fit: cover;
      object-position: center;
      transition: transform 500ms var(--ease-gentle);
    }

    &:hover img {
      transform: scale(1.06);
    }
  }

  .article-info {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--spacing-lg) var(--spacing-xl);
    min-height: 0;
  }

  .article-header {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    overflow: hidden;
    min-height: 0;
  }

  .article-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    text-decoration: none;
    line-height: var(--line-height-tight);
    transition: color var(--transition-fast) var(--ease-gentle);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &:hover {
      color: var(--color-blue);
    }
  }

  .article-summary {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    line-height: var(--line-height-base);
    overflow: hidden;
    margin: 0;
  }

  .article-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
  }

  .article-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-md);
  }

  .article-theme {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: rgba(126, 182, 217, 0.1);
    color: var(--color-blue);
    border-radius: 20px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    transition:
      background var(--transition-fast) var(--ease-gentle),
      color var(--transition-fast) var(--ease-gentle);
    white-space: nowrap;

    :global(svg) {
      flex-shrink: 0;
    }

    &:hover {
      background: rgba(126, 182, 217, 0.2);
      color: var(--color-blue-d10);
    }
  }

  .article-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    background: rgba(232, 164, 180, 0.08);
    color: var(--color-pink);
    border-radius: 16px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    transition:
      background var(--transition-fast) var(--ease-gentle),
      color var(--transition-fast) var(--ease-gentle);
    white-space: nowrap;

    .tag-hash {
      opacity: 0.6;
      margin-right: 1px;
    }

    &:hover {
      background: rgba(232, 164, 180, 0.18);
      color: var(--color-pink-d10);
    }
  }

  @media (max-width: 768px) {
    .article-card,
    .article-card.reversed {
      grid-template-columns: 1fr;

      .article-cover {
        order: 0;
        min-height: 180px;
      }

      .article-info {
        order: 1;
      }
    }
  }
</style>
