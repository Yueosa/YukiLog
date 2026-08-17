<script lang="ts">
	import { onMount } from 'svelte';
	import { statsApi } from '$lib/api';
	import type { SiteStats } from '$types';

	let stats: SiteStats | null = $state(null);

	const quickLinks = [
		{ label: '文章管理', icon: '📝', href: '/admin/posts', desc: '管理所有文章' },
		{ label: '评论管理', icon: '💬', href: '/admin/comments', desc: '审核和管理评论' },
		{ label: '主题管理', icon: '🎨', href: '/admin/themes', desc: '管理文章主题分类' },
		{ label: '标签管理', icon: '🏷️', href: '/admin/tags', desc: '管理文章标签' },
		{ label: '友链管理', icon: '🔗', href: '/admin/links', desc: '管理友情链接' },
		{ label: '随记管理', icon: '📓', href: '/admin/notes', desc: '管理随记内容' },
	];

	onMount(async () => {
		try {
			stats = await statsApi.get();
		} catch { /* 静默失败 */ }
	});
</script>

<svelte:head>
	<title>管理后台 - YukiLog</title>
</svelte:head>

<div class="dashboard">
	<div class="welcome-card">
		<h2>欢迎回来 👋</h2>
		<p>在这里管理你的博客内容</p>
	</div>

	{#if stats}
		<div class="stats-row">
			<div class="stat-item">
				<span class="stat-value">{stats.total_posts}</span>
				<span class="stat-label">文章</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">{stats.total_views}</span>
				<span class="stat-label">总浏览</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">{stats.total_words}</span>
				<span class="stat-label">总字数</span>
			</div>
		</div>
	{/if}

	<div class="quick-links">
		{#each quickLinks as link}
			<a href={link.href} class="quick-card">
				<div class="quick-card-top">
					<span class="quick-icon">{link.icon}</span>
				</div>
				<h3>{link.label}</h3>
				<p>{link.desc}</p>
			</a>
		{/each}
	</div>
</div>

<style>
	.dashboard {
		width: 100%;
	}

	.welcome-card {
		padding: 2rem 2.5rem;
		background: var(--gradient-blue-pink);
		border-radius: 20px;
		margin-bottom: 2rem;
	}

	.welcome-card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.welcome-card p {
		margin: 0;
		color: var(--color-text-light);
		font-size: 0.9375rem;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-item {
		background: var(--color-white);
		border-radius: 16px;
		padding: 1.25rem;
		text-align: center;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-divider);
	}

	.stat-value {
		display: block;
		font-size: 1.75rem;
		font-weight: 700;
		background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-pink) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.stat-label {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.quick-links {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.quick-card {
		background: var(--color-white);
		border-radius: 20px;
		padding: 1.75rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-divider);
		text-decoration: none;
		transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
	}

	.quick-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--color-blue), var(--color-pink));
		opacity: 0;
		transition: opacity 300ms;
	}

	.quick-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-blue-md);
		border-color: var(--blue-alpha-30);
	}

	.quick-card:hover::before {
		opacity: 1;
	}

	.quick-card-top {
		margin-bottom: 1rem;
	}

	.quick-icon {
		font-size: 2rem;
	}

	.quick-card h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.quick-card p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}
</style>
