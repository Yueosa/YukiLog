<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { adminApi, themesApi, tagsApi } from '$lib/api';
	import { isValidSlug } from '$lib/slugify';
	import PostTaxonomyFields from '$components/admin/PostTaxonomyFields.svelte';
	import type { Theme, Tag, PostWithRelations } from '$types';

	let originalPost = $state<PostWithRelations | null>(null);
	let title = $state('');
	let slug = $state('');
	let summary = $state('');
	let coverImage = $state('');
	let themeSlug = $state('');
	let isFeatured = $state(false);
	let selectedTagSlugs: Set<string> = $state(new Set());

	let themes: Theme[] = $state([]);
	let tags: Tag[] = $state([]);
	let editor: any = $state(null);
	let publishing = $state(false);
	let saving = $state(false);

	let pageLoading = $state(true);
	let loadError = $state('');

	async function handleSubmit(status: 'draft' | 'published') {
		if (!originalPost) return;
		const content = editor?.getValue?.() || '';

		if (!title.trim() || !slug.trim() || !content.trim()) {
			alert('标题、Slug 和内容不能为空');
			return;
		}

		if (!isValidSlug(slug)) {
			alert('Slug 格式不正确，仅支持小写字母、数字和连字符');
			return;
		}

		if (status === 'published') publishing = true;
		else saving = true;

		// 三态字段处理
		const data: any = {
			title: title.trim(),
			slug: slug.trim(),
			content,
			status,
			tag_slugs: Array.from(selectedTagSlugs),
			is_featured: isFeatured,
		};

		const summaryVal = summary.trim();
		if (summaryVal) data.summary = summaryVal;
		else if (originalPost.post.summary && !summaryVal) data.summary = null;

		const coverVal = coverImage.trim();
		if (coverVal) data.cover_image = coverVal;
		else if (originalPost.post.cover_image && !coverVal) data.cover_image = null;

		const themeVal = themeSlug;
		if (themeVal) data.theme_slug = themeVal;
		else if (originalPost.theme && !themeVal) data.theme_slug = null;

		try {
			await adminApi.posts.update(originalPost.post.slug, data);
			alert(`文章「${title.trim()}」${status === 'published' ? '更新' : '保存为草稿'}成功！`);
			goto('/admin/posts');
		} catch (err: any) {
			alert(err.message || '操作失败');
		} finally {
			publishing = false;
			saving = false;
		}
	}

	function initVditor(initialContent: string) {
		const Vditor = (window as any).Vditor;
		if (!Vditor) {
			console.error('Vditor not loaded');
			return;
		}

		const editorEl = document.getElementById('vditor-editor');
		if (!editorEl) {
			console.error('Failed to get element by id: vditor-editor');
			// 延迟重试
			setTimeout(() => initVditor(initialContent), 100);
			return;
		}

		editor = new Vditor('vditor-editor', {
			mode: 'ir',
			height: 600,
			placeholder: '开始写作吧...',
			theme: 'classic',
			counter: { enable: true, type: 'markdown' },
			cache: { enable: false },
			toolbar: [
				'headings', 'bold', 'italic', 'strike', '|',
				'quote', 'code', 'line', '|',
				'list', 'ordered-list', 'check', '|',
				'link', 'table', '|',
				'undo', 'redo', '|',
				'preview', 'fullscreen'
			],
			upload: {
				handler: () => {
					alert('请使用图床外链 URL（例如：![alt](https://example.com/image.jpg)）');
					return null;
				}
			},
			after: () => {
				if (initialContent) editor.setValue(initialContent);
			}
		});
	}

	let cdnLink: HTMLLinkElement | null = null;
	let cdnScript: HTMLScriptElement | null = null;

	onMount(() => {
		const postSlug = page.params.slug;
		if (!postSlug) { loadError = '缺少文章 slug'; pageLoading = false; return; }

		// 加载 Vditor CDN
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.css';
		document.head.appendChild(link);
		cdnLink = link;

		const scriptEl = document.createElement('script');
		scriptEl.src = 'https://cdn.jsdelivr.net/npm/vditor@3.11.2/dist/index.min.js';
		document.head.appendChild(scriptEl);
		cdnScript = scriptEl;

		scriptEl.onload = async () => {
			try {
				const [post, themeList, tagList] = await Promise.all([
					adminApi.posts.getBySlug(postSlug),
					themesApi.list(),
					tagsApi.list()
				]);

				originalPost = post;
				themes = themeList;
				tags = tagList;

				// 预填数据
				title = post.post.title;
				slug = post.post.slug;
				summary = post.post.summary || '';
				coverImage = post.post.cover_image || '';
				themeSlug = post.theme?.slug || '';
				isFeatured = post.post.is_featured ?? false;

				if (post.tags) {
					selectedTagSlugs = new Set(post.tags.map(t => t.slug));
				}

				initVditor(post.post.content);
				pageLoading = false;
			} catch (err: any) {
				loadError = err.message || '加载失败';
				pageLoading = false;
			}
		};

		scriptEl.onerror = () => {
			loadError = 'Vditor 加载失败';
			pageLoading = false;
		};

		return () => {
			cdnLink?.remove();
			cdnScript?.remove();
		};
	});

	const isDraft = $derived(originalPost ? originalPost.post.status === 'draft' : false);
	const publishBtnText = $derived(isDraft ? '发布文章' : '更新文章');
	const draftBtnText = $derived(isDraft ? '保存草稿' : '撤回为草稿');
</script>

<svelte:head>
	<title>编辑文章 - YukiLog</title>
</svelte:head>

{#if pageLoading}
	<div class="admin-loading">
		<div class="spinner"></div>
		<p>加载文章数据...</p>
	</div>
{:else if loadError}
	<div class="admin-error">
		<p>{loadError}</p>
		<button class="btn-retry" onclick={() => goto('/admin/posts')}>返回列表</button>
	</div>
{:else}
	<form class="post-form" onsubmit={(e) => { e.preventDefault(); handleSubmit('published'); }}>
		<!-- 基础信息 -->
		<div class="form-section">
			<h3 class="section-title">基础信息</h3>
			<div class="form-row">
				<div class="form-group">
					<label for="title">文章标题 *</label>
					<input type="text" id="title" bind:value={title} required placeholder="例如：使用 Rust 构建博客后端" />
				</div>
				<div class="form-group">
					<label for="slug">URL Slug *</label>
					<input type="text" id="slug" bind:value={slug} required placeholder="建议编辑时不修改 slug" />
					<span class="form-hint">URL 路径：/posts/<span class="slug-preview">{slug || '...'}</span></span>
				</div>
			</div>

			<div class="form-group">
				<label for="summary">文章摘要</label>
				<textarea id="summary" bind:value={summary} rows="3" placeholder="简短介绍文章内容（可选）"></textarea>
			</div>

			<div class="form-group">
				<label for="cover_image">封面图 URL</label>
				<input type="url" id="cover_image" bind:value={coverImage} placeholder="https://example.com/cover.jpg" />
			</div>
		</div>

		<PostTaxonomyFields
			bind:themes
			bind:tags
			bind:themeSlug
			bind:selectedTagSlugs
			bind:isFeatured
		/>

		<!-- 文章内容 -->
		<div class="form-section">
			<h3 class="section-title">文章内容 *</h3>
			<div id="vditor-editor"></div>
		</div>

		<!-- 操作按钮 -->
		<div class="form-actions">
			<button type="button" class="btn-cancel" onclick={() => { if (confirm('确认取消？未保存的修改将丢失。')) goto('/admin/posts'); }}>取消</button>
			<button type="button" class="btn-draft" disabled={saving} onclick={() => handleSubmit('draft')}>
				{saving ? '保存中...' : draftBtnText}
			</button>
			<button type="submit" class="btn-publish" disabled={publishing}>
				{publishing ? '更新中...' : publishBtnText}
			</button>
		</div>
	</form>
{/if}

<style>
	.post-form {
		width: 100%;
	}

	.form-section {
		background: var(--color-white);
		border-radius: 16px;
		padding: 1.5rem 2rem;
		margin-bottom: 1.5rem;
		box-shadow: var(--shadow-sm);
	}

	.section-title {
		margin: 0 0 1.25rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--color-divider);
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}

	@media (max-width: 768px) {
		.form-row { grid-template-columns: 1fr; }
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: 0.5rem;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.625rem 1rem;
		font-size: 0.9375rem;
		color: var(--color-text);
		background: var(--color-white);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		font-family: inherit;
		transition: border-color 200ms, box-shadow 200ms;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-blue);
		box-shadow: 0 0 0 3px var(--blue-alpha-15);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.6;
	}

	.form-hint {
		display: block;
		margin-top: 4px;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.slug-preview {
		color: var(--color-blue);
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-weight: 500;
	}

	:global(#vditor-editor) {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	:global(#vditor-editor .vditor) {
		border: none;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem 2rem;
		background: var(--color-white);
		border-radius: 16px;
		box-shadow: var(--shadow-sm);
	}

	.form-actions button {
		padding: 0.625rem 1.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: all 200ms;
	}

	.form-actions button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-cancel {
		color: var(--color-text-light);
		background: var(--color-bg);
	}

	.btn-cancel:hover:not(:disabled) {
		background: var(--color-bg-d5);
	}

	.btn-draft {
		color: #e8984a;
		background: rgba(232, 152, 74, 0.1);
	}

	.btn-draft:hover:not(:disabled) {
		background: rgba(232, 152, 74, 0.2);
	}

	.btn-publish {
		color: var(--color-on-primary);
		background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-pink) 100%);
	}

	.btn-publish:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--shadow-blue-md);
	}
</style>
