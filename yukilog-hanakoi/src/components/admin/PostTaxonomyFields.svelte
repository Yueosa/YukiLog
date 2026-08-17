<script lang="ts">
	import { adminApi } from '$lib/api';
	import { generateSlug, isValidSlug } from '$lib/slugify';
	import type { Theme, Tag } from '$types';

	let {
		themes = $bindable(),
		tags = $bindable(),
		themeSlug = $bindable(''),
		selectedTagSlugs = $bindable(),
		isFeatured = $bindable(false),
	}: {
		themes: Theme[];
		tags: Tag[];
		themeSlug: string;
		selectedTagSlugs: Set<string>;
		isFeatured: boolean;
	} = $props();

	let showThemeForm = $state(false);
	let themeName = $state('');
	let themeFormSlug = $state('');
	let themeDescription = $state('');
	let themeSlugManual = $state(false);
	let creatingTheme = $state(false);
	let themeError = $state('');

	let tagName = $state('');
	let tagFormSlug = $state('');
	let tagSlugManual = $state(false);
	let creatingTag = $state(false);
	let tagError = $state('');

	function toggleTag(slug: string) {
		const next = new Set(selectedTagSlugs);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		selectedTagSlugs = next;
	}

	function resetThemeForm() {
		themeName = '';
		themeFormSlug = '';
		themeDescription = '';
		themeSlugManual = false;
		themeError = '';
		showThemeForm = false;
	}

	function resetTagForm() {
		tagName = '';
		tagFormSlug = '';
		tagSlugManual = false;
		tagError = '';
	}

	function handleThemeNameInput() {
		if (!themeSlugManual) {
			themeFormSlug = generateSlug(themeName, 'theme');
		}
	}

	function handleTagNameInput() {
		if (!tagSlugManual) {
			tagFormSlug = generateSlug(tagName, 'tag');
		}
	}

	function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
		const n = name.toLowerCase();
		return items.find((item) => item.name.toLowerCase() === n);
	}

	function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
		return items.find((item) => item.slug === slug);
	}

	async function createTheme() {
		const name = themeName.trim();
		const slug = themeFormSlug.trim();
		if (!name || !slug) {
			themeError = '名称和 Slug 不能为空';
			return;
		}
		if (!isValidSlug(slug)) {
			themeError = 'Slug 仅支持小写字母、数字和连字符';
			return;
		}
		const existingByName = findByName(themes, name);
		if (existingByName) {
			themeSlug = existingByName.slug;
			resetThemeForm();
			return;
		}
		const existingBySlug = findBySlug(themes, slug);
		if (existingBySlug) {
			themeError = `Slug「${slug}」已被「${existingBySlug.name}」占用，请改一下`;
			return;
		}

		creatingTheme = true;
		themeError = '';
		try {
			const created = await adminApi.themes.create({
				name,
				slug,
				description: themeDescription.trim() || undefined,
			});
			themes = [...themes, created];
			themeSlug = created.slug;
			resetThemeForm();
		} catch (err: any) {
			themeError = err.message || '创建主题失败';
		} finally {
			creatingTheme = false;
		}
	}

	async function createTag() {
		const name = tagName.trim();
		const slug = tagFormSlug.trim() || generateSlug(name, 'tag');
		if (!name) {
			tagError = '请输入标签名称';
			return;
		}
		if (!isValidSlug(slug)) {
			tagError = 'Slug 仅支持小写字母、数字和连字符';
			return;
		}

		const existingByName = findByName(tags, name);
		if (existingByName) {
			const next = new Set(selectedTagSlugs);
			next.add(existingByName.slug);
			selectedTagSlugs = next;
			resetTagForm();
			return;
		}
		const existingBySlug = findBySlug(tags, slug);
		if (existingBySlug) {
			tagError = `Slug「${slug}」已被「#${existingBySlug.name}」占用，请改一下`;
			return;
		}

		creatingTag = true;
		tagError = '';
		try {
			const created = await adminApi.tags.create({ name, slug });
			tags = [...tags, created];
			const next = new Set(selectedTagSlugs);
			next.add(created.slug);
			selectedTagSlugs = next;
			resetTagForm();
		} catch (err: any) {
			tagError = err.message || '创建标签失败';
		} finally {
			creatingTag = false;
		}
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (!creatingTag) createTag();
		}
	}
</script>

<div class="form-section">
	<h3 class="section-title">分类与标签</h3>

	<div class="form-group">
		<div class="field-head">
			<label for="theme_slug">主题分类</label>
			{#if !showThemeForm}
				<button type="button" class="btn-inline" onclick={() => (showThemeForm = true)}>
					+ 新建主题
				</button>
			{/if}
		</div>
		<select id="theme_slug" bind:value={themeSlug}>
			<option value="">无主题</option>
			{#each themes as theme}
				<option value={theme.slug}>{theme.name}</option>
			{/each}
		</select>
	</div>

	{#if showThemeForm}
		<div class="inline-create">
			<div class="inline-row">
				<div class="form-group">
					<label for="new-theme-name">主题名称 *</label>
					<input
						type="text"
						id="new-theme-name"
						bind:value={themeName}
						oninput={handleThemeNameInput}
						placeholder="例如：技术笔记"
					/>
				</div>
				<div class="form-group">
					<label for="new-theme-slug">URL Slug *</label>
					<input
						type="text"
						id="new-theme-slug"
						bind:value={themeFormSlug}
						oninput={() => (themeSlugManual = true)}
						placeholder="自动生成，可手动修改"
					/>
				</div>
			</div>
			<div class="form-group">
				<label for="new-theme-desc">简介</label>
				<input
					type="text"
					id="new-theme-desc"
					bind:value={themeDescription}
					placeholder="可选"
				/>
			</div>
			{#if themeError}
				<p class="create-error">{themeError}</p>
			{/if}
			<div class="inline-actions">
				<button type="button" class="btn-ghost" onclick={resetThemeForm}>取消</button>
				<button type="button" class="btn-add" disabled={creatingTheme} onclick={createTheme}>
					{creatingTheme ? '创建中...' : '创建并选用'}
				</button>
			</div>
		</div>
	{/if}

	<div class="form-group">
		<fieldset class="tag-fieldset">
			<legend>标签</legend>
			<div class="tag-checkboxes">
				{#if tags.length === 0}
					<p class="empty-hint">还没有标签，在下方直接新建即可</p>
				{:else}
					{#each tags as tag}
						<label class="tag-checkbox-label" class:checked={selectedTagSlugs.has(tag.slug)}>
							<input
								type="checkbox"
								checked={selectedTagSlugs.has(tag.slug)}
								onchange={() => toggleTag(tag.slug)}
							/>
							<span class="tag-name">#{tag.name}</span>
						</label>
					{/each}
				{/if}
			</div>
			<div class="tag-create">
				<input
					type="text"
					bind:value={tagName}
					oninput={handleTagNameInput}
					onkeydown={handleTagKeydown}
					placeholder="输入标签名，回车创建"
					disabled={creatingTag}
				/>
				<input
					type="text"
					class="slug-input"
					bind:value={tagFormSlug}
					oninput={() => (tagSlugManual = true)}
					placeholder="slug"
					disabled={creatingTag}
					aria-label="标签 Slug"
				/>
				<button type="button" class="btn-add" disabled={creatingTag} onclick={createTag}>
					{creatingTag ? '添加中...' : '添加'}
				</button>
			</div>
			{#if tagError}
				<p class="create-error">{tagError}</p>
			{/if}
			<span class="form-hint">已选择 {selectedTagSlugs.size} 个标签</span>
		</fieldset>
	</div>

	<div class="form-group">
		<label class="featured-toggle">
			<input type="checkbox" bind:checked={isFeatured} />
			<span>设为精选文章</span>
		</label>
		<span class="form-hint">精选文章将显示在主页文章列表中</span>
	</div>
</div>

<style>
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

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label,
	.tag-fieldset legend {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: 0.5rem;
	}

	.form-group input,
	.form-group select,
	.tag-create input {
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
	.tag-create input:focus {
		outline: none;
		border-color: var(--color-blue);
		box-shadow: 0 0 0 3px var(--blue-alpha-15);
	}

	.field-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.field-head label {
		margin-bottom: 0;
	}

	.btn-inline {
		padding: 0;
		border: none;
		background: none;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-blue);
		cursor: pointer;
	}

	.btn-inline:hover {
		text-decoration: underline;
	}

	.inline-create {
		margin: -0.5rem 0 1.25rem;
		padding: 1rem 1.125rem;
		background: var(--color-bg);
		border: 1px dashed var(--color-border);
		border-radius: 12px;
	}

	.inline-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.inline-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.tag-fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}

	.tag-checkboxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.625rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		max-height: 200px;
		overflow-y: auto;
	}

	.empty-hint {
		margin: 0;
		padding: 0.25rem 0.25rem;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.tag-checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		background: var(--color-white);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		cursor: pointer;
		transition: all 200ms;
	}

	.tag-checkbox-label:hover {
		border-color: var(--color-blue);
	}

	.tag-checkbox-label.checked {
		background: var(--pink-alpha-08);
		border-color: var(--color-pink);
	}

	.tag-checkbox-label.checked .tag-name {
		color: var(--color-pink);
		font-weight: 500;
	}

	.tag-checkbox-label input[type='checkbox'] {
		width: auto;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}

	.tag-name {
		font-size: 0.75rem;
		color: var(--color-text-light);
		user-select: none;
	}

	.tag-create {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
		gap: 0.5rem;
		margin-top: 0.625rem;
	}

	.tag-create .slug-input {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.8125rem;
	}

	.btn-add,
	.btn-ghost {
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 10px;
		cursor: pointer;
		transition: all 200ms;
		white-space: nowrap;
	}

	.btn-add {
		color: var(--color-on-primary);
		background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-pink) 100%);
		border: none;
	}

	.btn-add:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--shadow-blue-md);
	}

	.btn-ghost {
		color: var(--color-text-light);
		background: var(--color-white);
		border: 1px solid var(--color-border);
	}

	.btn-ghost:hover {
		background: var(--color-bg-d5);
	}

	.btn-add:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.create-error {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: var(--color-error);
	}

	.form-hint {
		display: block;
		margin-top: 4px;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.featured-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: 0;
	}

	.featured-toggle input[type='checkbox'] {
		width: 16px;
		height: 16px;
		padding: 0;
		cursor: pointer;
		accent-color: var(--color-pink);
	}

	@media (max-width: 768px) {
		.inline-row,
		.tag-create {
			grid-template-columns: 1fr;
		}
	}
</style>
