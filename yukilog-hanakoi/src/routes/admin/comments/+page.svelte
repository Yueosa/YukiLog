<script lang="ts">
	import { onMount } from 'svelte';
	import { adminApi } from '$lib/api';
	import { formatDate } from '$lib/date';
	import type { Comment } from '$types';

	let allComments: Comment[] = $state([]);
	let pendingCount = $state(0);
	let loading = $state(true);
	let error = $state('');
	let currentStatus: string = $state('all');

	// 编辑弹窗
	let editingComment: Comment | null = $state(null);
	let editContent = $state('');
	let editName = $state('');
	let editEmail = $state('');
	let editWebsite = $state('');
	let submitting = $state(false);

	// 删除确认
	let deleteTarget: Comment | null = $state(null);
	let deleting = $state(false);

	const statusTabs: { key: string; label: string }[] = [
		{ key: 'all', label: '全部' },
		{ key: 'pending', label: '待审核' },
		{ key: 'approved', label: '已通过' },
		{ key: 'spam', label: '垃圾' },
	];

	const filteredComments = $derived(
		currentStatus === 'all'
			? allComments
			: allComments.filter(c => c.status === currentStatus)
	);

	function getStatusText(status: string): string {
		const map: Record<string, string> = { pending: '待审核', approved: '已通过', spam: '垃圾' };
		return map[status] || status;
	}

	async function loadComments() {
		loading = true;
		error = '';
		try {
			const [res, pending] = await Promise.all([
				adminApi.comments.list({ page: 1, page_size: 9999 }),
				adminApi.comments.pending()
			]);
			allComments = res.items;
			pendingCount = pending.length;
		} catch (err: any) {
			error = err.message || '加载失败';
		} finally {
			loading = false;
		}
	}

	function switchTab(status: string) {
		currentStatus = status;
	}

	async function handleApprove(id: number) {
		try {
			await adminApi.comments.approve(id);
			await loadComments();
		} catch (err: any) {
			alert(err.message || '操作失败');
		}
	}

	async function handleReject(id: number) {
		try {
			await adminApi.comments.reject(id);
			await loadComments();
		} catch (err: any) {
			alert(err.message || '操作失败');
		}
	}

	function openEditModal(comment: Comment) {
		editingComment = comment;
		editContent = comment.content;
		editName = comment.guest_nick;
		editEmail = comment.guest_email || '';
		editWebsite = comment.guest_website || '';
	}

	function closeEditModal() {
		editingComment = null;
	}

	async function handleEditSubmit() {
		if (!editingComment) return;
		submitting = true;
		try {
			await adminApi.comments.update(editingComment.id, {
				content: editContent.trim(),
				guest_nick: editName.trim(),
				guest_email: editEmail.trim() || undefined,
				guest_website: editWebsite.trim() || undefined,
			});
			closeEditModal();
			await loadComments();
		} catch (err: any) {
			alert(err.message || '操作失败');
		} finally {
			submitting = false;
		}
	}

	function confirmDelete(comment: Comment) {
		deleteTarget = comment;
	}

	async function executeDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await adminApi.comments.delete(deleteTarget.id);
			deleteTarget = null;
			await loadComments();
		} catch (err: any) {
			alert(err.message || '删除失败');
		} finally {
			deleting = false;
		}
	}

	onMount(() => { loadComments(); });
</script>

<svelte:head>
	<title>评论管理 - YukiLog</title>
</svelte:head>

<!-- 待审核提示 -->
{#if pendingCount > 0}
	<div class="notice">
		<div class="notice-icon">⏳</div>
		<div class="notice-content">
			<h4>有新的评论等待审核</h4>
			<p>共 <strong>{pendingCount}</strong> 条待审核评论，点击下方「待审核」标签查看</p>
		</div>
	</div>
{/if}

<!-- 操作栏 -->
<div class="action-bar">
	<div class="tabs">
		{#each statusTabs as tab}
			<button class="tab" class:active={currentStatus === tab.key} onclick={() => switchTab(tab.key)}>{tab.label}</button>
		{/each}
	</div>
</div>

<!-- 内容区 -->
{#if loading}
	<div class="admin-loading"><div class="spinner"></div><p>加载中...</p></div>
{:else if error}
	<div class="admin-error"><p>{error}</p><button class="btn-retry" onclick={loadComments}>重新加载</button></div>
{:else if filteredComments.length === 0}
	<div class="admin-empty"><p>暂无评论</p></div>
{:else}
	<div class="comments-list">
		{#each filteredComments as comment (comment.id)}
			<div class="comment-card">
				<div class="comment-top">
					<div class="comment-avatar">
						{comment.guest_nick.charAt(0).toUpperCase()}
					</div>
					<div class="comment-info">
						<div class="comment-author">
							<span class="author-name">{comment.guest_nick}</span>
							{#if comment.guest_email}
								<span class="author-email">{comment.guest_email}</span>
							{/if}
						</div>
						<div class="comment-date">{formatDate(comment.created_at)}</div>
					</div>
					<span class="status-badge status-{comment.status}">{getStatusText(comment.status)}</span>
				</div>

				<div class="comment-content">{comment.content}</div>

				<div class="comment-post">
					{#if comment.post_slug}
						<a href="/posts/{comment.post_slug}" target="_blank" rel="noopener noreferrer" class="post-chip">
							来自：{comment.post_title || comment.post_slug}
						</a>
					{:else}
						<span class="post-chip muted">未关联文章</span>
					{/if}
				</div>

				<div class="comment-actions">
					{#if comment.status === 'pending'}
						<button class="action-btn approve" onclick={() => handleApprove(comment.id)}>通过</button>
						<button class="action-btn reject" onclick={() => handleReject(comment.id)}>拒绝</button>
					{/if}
					{#if comment.status === 'approved'}
						<button class="action-btn reject" onclick={() => handleReject(comment.id)}>标为垃圾</button>
					{/if}
					{#if comment.status === 'spam'}
						<button class="action-btn approve" onclick={() => handleApprove(comment.id)}>通过</button>
					{/if}
					<button class="action-btn edit" onclick={() => openEditModal(comment)}>编辑</button>
					<button class="action-btn delete" onclick={() => confirmDelete(comment)}>删除</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- 编辑弹窗 -->
{#if editingComment}
	<div class="modal-backdrop" onclick={closeEditModal} role="presentation"></div>
	<div class="modal-card">
		<div class="modal-header">
			<h3>编辑评论</h3>
			<button class="modal-close" onclick={closeEditModal}>×</button>
		</div>
		<div class="modal-body">
			<div class="form-group">
				<label for="edit-content">内容</label>
				<textarea id="edit-content" bind:value={editContent} rows="4"></textarea>
			</div>
			<div class="form-group">
				<label for="edit-name">昵称</label>
				<input type="text" id="edit-name" bind:value={editName} />
			</div>
			<div class="form-group">
				<label for="edit-email">邮箱</label>
				<input type="email" id="edit-email" bind:value={editEmail} />
			</div>
			<div class="form-group">
				<label for="edit-website">网站</label>
				<input type="url" id="edit-website" bind:value={editWebsite} />
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={closeEditModal}>取消</button>
			<button class="btn-primary" disabled={submitting} onclick={handleEditSubmit}>
				{submitting ? '保存中...' : '保存'}
			</button>
		</div>
	</div>
{/if}

<!-- 删除确认弹窗 -->
{#if deleteTarget}
	<div class="modal-backdrop" onclick={() => (deleteTarget = null)} role="presentation"></div>
	<div class="modal-card">
		<div class="modal-header">
			<h3>确认删除</h3>
			<button class="modal-close" onclick={() => (deleteTarget = null)}>×</button>
		</div>
		<div class="modal-body">
			<div class="confirm-body">
				<div class="confirm-icon">⚠️</div>
				<p class="confirm-title">删除来自「{deleteTarget.guest_nick}」的评论？</p>
				<p class="confirm-desc">此操作不可撤销。</p>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn-secondary" onclick={() => (deleteTarget = null)}>取消</button>
			<button class="btn-danger" disabled={deleting} onclick={executeDelete}>
				{deleting ? '删除中...' : '确认删除'}
			</button>
		</div>
	</div>
{/if}

<style>
	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.comment-card {
		background: var(--color-white);
		border-radius: 16px;
		padding: 1.25rem 1.5rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-divider);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.comment-card:hover {
		box-shadow: var(--shadow-blue-md);
		border-color: var(--blue-alpha-30);
	}

	.comment-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.comment-avatar {
		width: 42px;
		height: 42px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		font-weight: 700;
		color: white;
		flex-shrink: 0;
	}

	.comment-info {
		flex: 1;
		min-width: 0;
	}

	.comment-author {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.author-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.author-email {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.comment-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.comment-content {
		font-size: 0.875rem;
		color: var(--color-text);
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.comment-post {
		display: flex;
	}

	.post-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		font-size: 0.75rem;
		color: var(--color-blue);
		background: var(--blue-alpha-08);
		border-radius: 12px;
		text-decoration: none;
		transition: all 200ms;
	}

	.post-chip:hover {
		background: var(--blue-alpha-15);
	}

	.post-chip.muted {
		color: var(--color-text-muted);
		background: var(--color-divider);
	}

	.comment-actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-divider);
	}
</style>
