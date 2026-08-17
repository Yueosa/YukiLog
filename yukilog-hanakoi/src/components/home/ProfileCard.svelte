<script lang="ts">
  import { siteConfig } from '$lib/config';
  import { socialIcons, uiIcons } from '$lib/svg-icons';

  const resolvedSocialIcons = siteConfig.social.map((s) => ({
    ...s,
    svg: socialIcons[s.icon as keyof typeof socialIcons] ?? '',
  }));

  const author = siteConfig.author;
  const systemLogText = `# system.log █\n> [${author.systemLog.timestamp}]  \n> "${author.systemLog.message}"`;
</script>

<div class="profile-card" id="profile-card">
  <div class="profile-avatar">
    <img
      src={siteConfig.author.avatar}
      alt={siteConfig.author.nickname}
      width="96"
      height="96"
      class="avatar-img"
      referrerpolicy="no-referrer"
    />
  </div>

  <div class="profile-nickname">{siteConfig.author.nickname}</div>

  <div class="profile-bio">{author.bio}</div>

  <div class="profile-meta">
    <div class="profile-meta-item">
      <span class="profile-meta-icon">{@html uiIcons.cake}</span>
      <span class="profile-meta-text">{author.birthday}</span>
    </div>
    <div class="profile-meta-item">
      <span class="profile-meta-dot" aria-hidden="true"></span>
      <span class="profile-meta-text">{author.genderIdentity}</span>
    </div>
  </div>

  <div class="profile-divider"></div>

  <div class="profile-social">
    {#each resolvedSocialIcons as s}
      {#if s.icon === 'gmail'}
        <span
          class="profile-social-btn"
          title={s.name}
          style="--icon-color: {s.color}"
        >
          <span class="social-svg">{@html s.svg}</span>
          <span class="social-name">{s.name}</span>
        </span>
      {:else}
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          class="profile-social-btn"
          title={s.name}
          style="--icon-color: {s.color}"
        >
          <span class="social-svg">{@html s.svg}</span>
          <span class="social-name">{s.name}</span>
        </a>
      {/if}
    {/each}
  </div>

  <div class="profile-log">
    <pre>{systemLogText}</pre>
  </div>
</div>

<style>
  .profile-card {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pink);
    padding: var(--spacing-xl) var(--spacing-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;

    opacity: 0;
    transform: translateX(-100px);
    transition: opacity 600ms cubic-bezier(0.22, 0.61, 0.36, 1),
                transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1);

    &:global(.visible) {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .profile-avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid var(--color-border);
    flex-shrink: 0;
    transition: transform 400ms cubic-bezier(0.22, 0.61, 0.36, 1),
                border-color 400ms var(--ease-gentle);

    &:hover {
      transform: scale(1.06);
      border-color: var(--color-pink);
    }
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .profile-nickname {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-pink);
    text-align: center;
  }

  .profile-bio {
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    text-align: center;
    line-height: var(--line-height-relaxed);
    max-width: 260px;
  }

  .profile-meta {
    margin-top: var(--spacing-sm);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .profile-meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    padding: 0 4px;
  }

  .profile-meta-icon {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-pink);

    :global(svg) {
      width: 100%;
      height: 100%;
      stroke: currentColor;
    }
  }

  .profile-meta-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-blue);
    opacity: 0.8;
  }

  .profile-meta-text {
    line-height: 1.2;
  }

  .profile-divider {
    width: 40px;
    height: 2px;
    background: var(--color-divider);
    margin: var(--spacing-md) 0;
    border-radius: 1px;
    transition: width 400ms var(--ease-gentle), background 400ms var(--ease-gentle);

    .profile-card:hover & {
      width: 60px;
      background: var(--color-pink);
    }
  }

  .profile-social {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .profile-social-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    color: var(--color-text-light);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-base) cubic-bezier(0.22, 0.61, 0.36, 1);

    .social-svg {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--icon-color);
      transition: transform var(--transition-base) cubic-bezier(0.22, 0.61, 0.36, 1);

      :global(svg) {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
    }

    .social-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      transition: color var(--transition-base) var(--ease-gentle);
    }

    &:hover {
      background: var(--color-bg);
      color: var(--icon-color);

      .social-svg {
        transform: scale(1.12);
      }

      .social-name {
        color: var(--icon-color);
      }
    }
  }

  .profile-log {
    width: 100%;
    margin-top: var(--spacing-md);

    pre {
      margin: 0;
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      background: rgba(44, 62, 80, 0.04);
      border: 1px solid var(--color-divider);
      color: var(--color-text-light);
      font-size: 11px;
      line-height: 1.5;
      font-family: var(--font-family-code);
      white-space: pre-wrap;
    }
  }

  @media (max-width: 768px) {
    .profile-card {
      padding: var(--spacing-lg) var(--spacing-md);
    }

    .profile-avatar {
      width: 80px;
      height: 80px;
    }

    .profile-nickname {
      font-size: var(--font-size-lg);
    }
  }
</style>
