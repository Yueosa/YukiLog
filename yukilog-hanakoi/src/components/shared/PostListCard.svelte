<script lang="ts">
  let { post, index = 0 }: {
    post: {
      title: string;
      slug: string;
      summary?: string | null;
      cover_image?: string | null;
      created_at: string;
      tags?: ReadonlyArray<{ readonly name: string; readonly slug: string }>;
    };
    index: number;
  } = $props();

  const hasCover = $derived(!!post.cover_image);
</script>

<a
  href="/posts/{post.slug}"
  class="post-list-card"
  class:has-cover={hasCover}
  style="--pi: {index}"
>
  <!-- 封面区域 -->
  <div class="plc-cover">
    <div class="plc-cover-inner">
      {#if hasCover}
        <img src={post.cover_image} alt="" loading="lazy" />
      {:else}
        <div class="plc-fallback"></div>
      {/if}
    </div>
    <div class="plc-overlay"></div>
  </div>

  <!-- 文字信息（绝对定位，贴底） -->
  <div class="plc-body">
    <h3 class="plc-title">{post.title}</h3>
    {#if post.summary}
      <p class="plc-summary">{post.summary}</p>
    {/if}
    <div class="plc-meta">
      <time class="plc-date">
        {new Date(post.created_at).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </time>
      {#if post.tags && post.tags.length > 0}
        <div class="plc-tags">
          {#each post.tags.slice(0, 3) as tag, ti}
            <span class="plc-tag" data-ti={ti}>#{tag.name}</span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</a>

<style>
  .post-list-card {
    position: relative;
    display: block;
    border-radius: 18px;
    border-left: 3px solid transparent;
    overflow: hidden;
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    break-inside: avoid;
    margin-bottom: 1.25rem;

    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 500ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 500ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 300ms cubic-bezier(0.4, 0, 0.2, 1);
    transition-delay: calc(var(--pi) * 60ms);
  }

  :global(.post-list-card.visible) {
    opacity: 1;
    transform: none;
  }

  .post-list-card:hover {
    box-shadow: var(--shadow-blue-md);
    border-left-color: var(--color-blue);
  }

  .post-list-card:nth-child(even):hover {
    box-shadow: var(--shadow-pink-md);
    border-left-color: var(--color-pink);
  }

  .plc-cover {
    position: relative;
    width: 100%;
  }

  .plc-cover-inner {
    width: 100%;
    overflow: hidden;
    border-radius: 18px;

    img {
      display: block;
      width: 100%;
      height: auto;
      min-height: 220px;
      object-fit: cover;
      object-position: center;
      transform-origin: center center;
      transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .post-list-card:hover .plc-cover-inner img {
    transform: scale(1.06);
  }

  .plc-fallback {
    width: 100%;
    min-height: 220px;
    background: linear-gradient(135deg, var(--blue-alpha-15) 0%, var(--pink-alpha-15) 100%);
  }

  .plc-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.05) 0%,
      rgba(0, 0, 0, 0.25) 50%,
      rgba(0, 0, 0, 0.55) 100%
    );
    pointer-events: none;
  }

  .post-list-card:not(.has-cover) .plc-overlay {
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.03) 0%,
      rgba(0, 0, 0, 0.08) 100%
    );
  }

  .plc-body {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .plc-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #fff;
    margin: 0;
    line-height: 1.4;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: color 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .post-list-card:not(.has-cover) .plc-title {
    color: var(--color-text);
    text-shadow: none;
  }

  .post-list-card:hover .plc-title {
    color: var(--color-blue-light);
  }

  .post-list-card:nth-child(even):hover .plc-title {
    color: var(--color-pink-light);
  }

  .plc-summary {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.65;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .post-list-card:not(.has-cover) .plc-summary {
    color: var(--color-text-light);
    text-shadow: none;
  }

  .plc-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .plc-date {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.85);
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .post-list-card:not(.has-cover) .plc-date {
    color: var(--color-text-muted);
    text-shadow: none;
  }

  .plc-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* 有封面：标签叠在深色遮罩上 */
  .has-cover .plc-tag {
    font-size: 0.6875rem;
    padding: 2px 9px;
    border-radius: 12px;
    backdrop-filter: blur(8px);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: opacity 200ms ease;

    &:hover {
      opacity: 0.9;
    }
  }

  .has-cover .plc-tag[data-ti="0"] {
    color: #cce8f8;
    background: rgba(126, 182, 217, 0.28);
    border: 1px solid rgba(126, 182, 217, 0.45);
  }

  .has-cover .plc-tag[data-ti="1"] {
    color: #fcd5de;
    background: rgba(232, 164, 180, 0.28);
    border: 1px solid rgba(232, 164, 180, 0.45);
  }

  .has-cover .plc-tag[data-ti="2"] {
    color: #e8d8f8;
    background: rgba(180, 150, 210, 0.25);
    border: 1px solid rgba(180, 150, 210, 0.40);
  }

  /* 无封面 */
  .post-list-card:not(.has-cover) .plc-tag {
    font-size: 0.6875rem;
    padding: 2px 9px;
    border-radius: 12px;
    backdrop-filter: none;
    text-shadow: none;
    transition: opacity 200ms ease;
  }

  .post-list-card:not(.has-cover) .plc-tag[data-ti="0"] {
    color: var(--color-blue);
    background: var(--blue-alpha-08);
    border: 1px solid var(--blue-alpha-20);
  }

  .post-list-card:not(.has-cover) .plc-tag[data-ti="1"] {
    color: var(--color-pink);
    background: var(--pink-alpha-08);
    border: 1px solid var(--pink-alpha-20);
  }

  .post-list-card:not(.has-cover) .plc-tag[data-ti="2"] {
    color: #9b7ac8;
    background: rgba(155, 122, 200, 0.08);
    border: 1px solid rgba(155, 122, 200, 0.20);
  }

  @media (max-width: 640px) {
    .post-list-card {
      margin-bottom: 1rem;
    }

    .plc-fallback {
      min-height: 200px;
    }

    .plc-body {
      padding: 1.25rem 1.5rem;
    }

    .plc-title {
      font-size: 1rem;
    }
  }
</style>
