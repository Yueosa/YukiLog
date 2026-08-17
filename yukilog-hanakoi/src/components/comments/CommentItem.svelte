<script lang="ts">
  import { marked } from 'marked';
  import type { CommentNode } from '$types/api';
  import { getRelativeTime } from '$lib/date';
  import { getCommentAvatar } from '$lib/avatar';
  import { sanitizeHtml } from '$lib/sanitize';
  import { contentConfig } from '$lib/config';
  import CommentReplyForm from './CommentReplyForm.svelte';
  import Self from './CommentItem.svelte';

  const cc = contentConfig.components.comments;
  const maxDepth = 4;

  let { node, depth = 0 }: { node: CommentNode; depth?: number } = $props();
  let comment = $derived(node.comment);
  let children = $derived(node.children);

  marked.setOptions({ breaks: true, gfm: true });
  let renderedContent = $derived(sanitizeHtml(marked.parse(comment.content) as string));
  let relativeTime = $derived(getRelativeTime(comment.created_at));
  let avatarUrl = $derived(
    getCommentAvatar(comment.guest_website, comment.guest_email, comment.avatar_url),
  );
  let isMaxDepth = $derived(depth >= maxDepth);

  let showReplyForm = $state(false);

  function toggleReply() {
    showReplyForm = !showReplyForm;
  }

  function handleReplySubmitted() {
    showReplyForm = false;
  }
</script>

<div class="comment-item" data-depth={depth}>
  <div class="comment-card">
    <!-- 头像 -->
    <div class="comment-avatar">
      <img src={avatarUrl} alt={comment.guest_nick} loading="lazy" />
    </div>

    <!-- 内容区 -->
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author" class:is-lian={comment.guest_nick === '恋'}>
          {comment.guest_nick}
        </span>
        <span class="comment-time">{relativeTime}</span>
      </div>

      <div class="comment-user-info">
        {#if comment.guest_website}
          <a href={comment.guest_website} target="_blank" rel="noopener noreferrer" class="user-website" title="访问网站">
            {cc.item.websiteIcon} {comment.guest_website}
          </a>
        {/if}
        {#if comment.visitor_info}
          <span class="comment-meta" title={comment.visitor_info}>
            <span class="meta-icon">📍</span>
            <span class="meta-text">{comment.visitor_info}</span>
          </span>
        {/if}
      </div>

      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="comment-content markdown-body">{@html renderedContent}</div>

      {#if showReplyForm}
        <div class="reply-form-container">
          <CommentReplyForm
            commentId={comment.id}
            commentNick={comment.guest_nick}
            onCancel={() => showReplyForm = false}
            onSubmitted={handleReplySubmitted}
          />
        </div>
      {/if}
    </div>

    <!-- 回复按钮 -->
    {#if !isMaxDepth}
      <button
        class="btn-reply"
        class:hidden={showReplyForm}
        onclick={toggleReply}
      >
        💬
      </button>
    {/if}
  </div>

  <!-- 子评论（递归） -->
  {#if children.length > 0}
    <div class="comment-children">
      {#each children as child}
        <Self node={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .comment-item {
    position: relative;
    margin-bottom: 20px;
  }

  .comment-children {
    margin-left: 40px;
    margin-top: 12px;
    padding-left: 16px;
    border-left: 2px solid var(--color-border-light);
  }

  .comment-card {
    position: relative;
    display: flex;
    gap: 12px;
    padding: 8px 0;
    transition:
      opacity var(--transition-fast) var(--ease-gentle),
      transform var(--transition-fast) var(--ease-gentle);

    &:hover {
      transform: scale(1.02);

      .btn-reply {
        opacity: 1;
      }
    }
  }

  .comment-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;

    img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 1px solid var(--color-border-lighter);
      object-fit: cover;
    }
  }

  .comment-body {
    flex: 1;
    min-width: 0;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    line-height: 1.2;
    flex-wrap: wrap;
  }

  .comment-author {
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
    color: var(--color-blue);
    text-decoration: none;
    transition: color var(--transition-fast) var(--ease-gentle);

    &.is-lian {
      color: var(--color-pink);
    }
  }

  .comment-time {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .comment-user-info {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 11px;
  }

  .user-website {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-blue);
    text-decoration: none;
    transition: opacity var(--transition-fast) var(--ease-gentle);

    &:hover {
      opacity: 0.7;
      text-decoration: underline;
    }
  }

  .comment-meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 11px;
    color: var(--color-text-light);
    background: var(--color-bg-tertiary);
    border-radius: 4px;
  }

  .meta-icon {
    flex-shrink: 0;
    font-size: 11px;
  }

  .meta-text {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .comment-content {
    margin-bottom: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-light);
    word-wrap: break-word;

    :global(p) {
      margin: 0 0 6px;
      &:last-child { margin-bottom: 0; }
    }

    :global(strong) {
      font-weight: var(--font-weight-semibold);
      color: var(--color-text);
    }

    :global(a) {
      color: var(--color-blue);
      text-decoration: none;
      border-bottom: 1px solid var(--color-blue-l20);
      transition: border-color var(--transition-fast) var(--ease-gentle);
      &:hover { border-color: var(--color-blue); }
    }

    :global(code) {
      padding: 2px 5px;
      background: var(--color-bg-tertiary);
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
      color: var(--color-pink-d10);
    }
  }

  .reply-form-container {
    margin-top: 8px;
  }

  .btn-reply {
    position: absolute;
    bottom: 8px;
    right: 0;
    padding: 3px 6px;
    background: transparent;
    border: none;
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity var(--transition-fast) var(--ease-gentle),
      transform var(--transition-fast) var(--ease-gentle);

    &:hover { transform: scale(1.15); }
    &:active { transform: scale(0.95); }
    &.hidden { display: none; }
  }

  @media (max-width: 640px) {
    .comment-avatar {
      width: 28px;
      height: 28px;
    }

    .comment-card {
      gap: 10px;
    }

    .btn-reply {
      opacity: 1;
    }
  }
</style>
