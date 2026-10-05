import { css } from 'lit';

/** 管理端夜航设计 token + 基础表单样式，所有壳层/组件/视图共享。 */
export const adminTheme = css`
  :host {
    --bg: #f7f8f7;
    --surface: #ffffff;
    --surface-muted: #eef2f5;
    --ink: #1c2733;
    --muted: #5d6b7a;
    --faint: #93a3b3;
    --line: #dde5ec;
    --primary: #7eb6d9;
    --primary-d: #4a93c2;
    --secondary: #e8a4b4;
    --secondary-d: #d57f95;
    --danger: #c04a63;
    --serif: 'LXGW WenKai', 'Noto Serif SC', serif;
    --mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  }

  * {
    box-sizing: border-box;
  }

  h1, h2, h3, p {
    margin-top: 0;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  /* ---------- 按钮 ---------- */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 18px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-size: 13px;
    letter-spacing: 0.04em;
    transition:
      background 220ms ease,
      border-color 220ms ease,
      color 220ms ease,
      translate 220ms ease,
      box-shadow 220ms ease;
  }

  .btn:hover:not(:disabled) {
    background: var(--primary-d);
    translate: 0 -1px;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.secondary {
    border-color: var(--line);
    background: var(--surface);
    color: var(--ink);
  }

  .btn.secondary:hover:not(:disabled) {
    border-color: var(--primary);
    background: var(--surface);
    color: var(--primary-d);
  }

  .btn.primary {
    background: var(--primary-d);
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--ink);
  }

  .btn.danger {
    background: transparent;
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
    color: var(--danger);
  }

  .btn.danger:hover:not(:disabled) {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .btn.small {
    padding: 4px 12px;
    font-size: 12px;
  }

  /* ---------- 表单 ---------- */
  .field {
    display: grid;
    gap: 6px;
    color: var(--muted);
    font-size: 12.5px;
  }

  .field > span {
    letter-spacing: 0.04em;
  }

  .field input,
  .field textarea,
  .field select {
    width: 100%;
    padding: 9px 13px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 13.5px;
    transition:
      border-color 220ms ease,
      box-shadow 220ms ease;
  }

  .field textarea {
    min-height: 120px;
    resize: vertical;
    line-height: 1.75;
  }

  .field input:focus,
  .field textarea:focus,
  .field select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
  }

  /* 自绘下拉：隐藏原生箭头，换夜航 chevron */
  .field select {
    appearance: none;
    padding-right: 34px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%2393a3b3' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 13px center;
    cursor: pointer;
  }

  /* ---------- 面板 / 卡片 ---------- */
  .panel {
    padding: 20px 22px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  .panel-title {
    margin: 0 0 14px;
    font-family: var(--serif);
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
  }

  /* ---------- 状态徽标 ---------- */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--surface-muted);
    color: var(--muted);
    font-size: 11.5px;
    white-space: nowrap;
  }

  .badge.ok {
    background: color-mix(in srgb, var(--primary) 18%, transparent);
    color: var(--primary-d);
  }

  .badge.warn {
    background: color-mix(in srgb, var(--secondary) 22%, transparent);
    color: var(--secondary-d);
  }

  .badge.danger {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }

  /* ---------- 表格 ---------- */
  .table-wrap {
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .table-wrap table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .table-wrap th {
    padding: 11px 14px;
    border-bottom: 1px solid var(--line);
    color: var(--faint);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-align: left;
    white-space: nowrap;
  }

  .table-wrap td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--surface-muted);
    color: var(--ink);
    vertical-align: top;
  }

  .table-wrap tr:last-child td {
    border-bottom: 0;
  }

  .muted {
    color: var(--muted);
  }

  .faint {
    color: var(--faint);
    font-size: 12px;
  }

  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
`;
