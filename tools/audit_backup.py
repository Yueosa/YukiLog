#!/usr/bin/env python3
"""Create a content-free integrity manifest for a YukiLog Markdown backup."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


SCHEMA_VERSION = 1
EXPECTED_SECTIONS = {
    "comments",
    "links",
    "notes",
    "pages",
    "posts",
    "tags",
    "themes",
}
REQUIRED_FRONTMATTER = {
    "posts": {
        "id",
        "title",
        "slug",
        "summary",
        "cover_image",
        "status",
        "is_featured",
        "theme",
        "tags",
        "view_count",
        "created_at",
        "updated_at",
    },
    "notes": {"id", "mood", "status", "created_at", "updated_at"},
}
URL_PATTERN = re.compile(r"https?://[^\s<>()\"'`]+")
FRONTMATTER_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):(?:\s*(.*))?$")
YUKILOG_SERIES = re.compile(r"^yukilog-(\d+)(?:-|$)")
DECLARED_COUNT_PATTERNS = {
    "comments": re.compile(r"\*\*(\d+)\*\*\s*条.*评论"),
    "links": re.compile(r"共\s*\**(\d+)\**\s*位"),
    "tags": re.compile(r"共\s*\**(\d+)\**\s*个标签"),
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_scalar(raw: str) -> object:
    raw = raw.strip()
    if not raw:
        return ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw.strip("\"'")


def parse_markdown(data: bytes) -> tuple[dict[str, object], str | None, str]:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        return {}, f"不是有效的 UTF-8：{error}", ""

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, None, text

    try:
        closing = next(
            index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"
        )
    except StopIteration:
        return {}, "front matter 缺少结束分隔符", text

    metadata: dict[str, object] = {}
    for line in lines[1:closing]:
        match = FRONTMATTER_LINE.match(line)
        if match:
            metadata[match.group(1)] = parse_scalar(match.group(2) or "")
    return metadata, None, "\n".join(lines[closing + 1 :])


def add_issue(
    issues: list[dict[str, str]], severity: str, path: str, message: str
) -> None:
    issues.append({"severity": severity, "path": path, "message": message})


def audit(source: Path) -> dict[str, object]:
    if not source.is_dir():
        raise ValueError(f"备份目录不存在：{source}")

    files: list[dict[str, object]] = []
    issues: list[dict[str, str]] = []
    section_counts: Counter[str] = Counter()
    content_counts: Counter[str] = Counter()
    declared_counts: dict[str, int] = {}
    external_domains: Counter[str] = Counter()
    post_ids: Counter[object] = Counter()
    note_ids: Counter[object] = Counter()
    slugs: Counter[object] = Counter()
    yukilog_numbers: list[int] = []

    paths = sorted(path for path in source.rglob("*") if path.is_file())
    for path in paths:
        relative = path.relative_to(source).as_posix()
        section = relative.split("/", 1)[0]
        data = path.read_bytes()
        entry: dict[str, object] = {
            "path": relative,
            "size": len(data),
            "sha256": sha256_bytes(data),
        }

        if path.is_symlink():
            add_issue(issues, "error", relative, "不接受符号链接")

        section_counts[section] += 1
        if path.suffix.lower() != ".md":
            add_issue(issues, "warning", relative, "不是 Markdown 文件")
            files.append(entry)
            continue

        metadata, parse_error, body = parse_markdown(data)
        entry["lines"] = data.count(b"\n") + (1 if data else 0)
        if parse_error:
            add_issue(issues, "error", relative, parse_error)

        is_content = path.name.lower() != "readme.md"
        if is_content:
            content_counts[section] += 1
        elif section in DECLARED_COUNT_PATTERNS:
            text = data.decode("utf-8", errors="replace")
            count_match = DECLARED_COUNT_PATTERNS[section].search(text)
            if count_match:
                declared_counts[section] = int(count_match.group(1))
            else:
                add_issue(issues, "warning", relative, "无法读取汇总记录数量")

        if section in REQUIRED_FRONTMATTER and is_content:
            if not metadata:
                add_issue(issues, "error", relative, "缺少 YAML front matter")
            missing = sorted(REQUIRED_FRONTMATTER[section] - metadata.keys())
            if missing:
                add_issue(
                    issues,
                    "error",
                    relative,
                    f"front matter 缺少字段：{', '.join(missing)}",
                )

            safe_metadata = {
                key: metadata[key]
                for key in ("id", "slug", "status", "cover_image", "created_at", "updated_at")
                if key in metadata
            }
            entry["metadata"] = safe_metadata

            if section == "posts":
                post_ids[metadata.get("id")] += 1
                slugs[metadata.get("slug")] += 1
                slug = metadata.get("slug")
                if isinstance(slug, str):
                    match = YUKILOG_SERIES.match(slug)
                    if match:
                        yukilog_numbers.append(int(match.group(1)))
            else:
                note_ids[metadata.get("id")] += 1

        for url in URL_PATTERN.findall(body):
            hostname = urlparse(url.rstrip(".,;]}")).hostname
            if hostname:
                external_domains[hostname.lower()] += 1
        cover = metadata.get("cover_image")
        if isinstance(cover, str) and cover.startswith(("http://", "https://")):
            hostname = urlparse(cover).hostname
            if hostname:
                external_domains[hostname.lower()] += 1

        files.append(entry)

    actual_sections = {path.relative_to(source).parts[0] for path in paths}
    for section in sorted(EXPECTED_SECTIONS - actual_sections):
        add_issue(issues, "error", section, "缺少备份分区")
    for section in sorted(actual_sections - EXPECTED_SECTIONS):
        add_issue(issues, "warning", section, "未知备份分区")

    for label, values in (
        ("文章 ID", post_ids),
        ("随记 ID", note_ids),
        ("文章 slug", slugs),
    ):
        for value, count in values.items():
            if value is not None and count > 1:
                add_issue(issues, "error", "*", f"{label} 重复：{value!r}（{count} 次）")

    content_counts.update(declared_counts)
    digest = hashlib.sha256()
    for entry in files:
        digest.update(str(entry["path"]).encode())
        digest.update(b"\0")
        digest.update(str(entry["sha256"]).encode())
        digest.update(b"\0")

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_name": source.name,
        "tree_sha256": digest.hexdigest(),
        "summary": {
            "files": len(files),
            "bytes": sum(int(entry["size"]) for entry in files),
            "section_files": dict(sorted(section_counts.items())),
            "content_items": dict(sorted(content_counts.items())),
            "external_domains": dict(external_domains.most_common()),
            "yukilog_series": sorted(yukilog_numbers),
            "errors": sum(issue["severity"] == "error" for issue in issues),
            "warnings": sum(issue["severity"] == "warning" for issue in issues),
        },
        "issues": issues,
        "files": files,
    }


def render_report(manifest: dict[str, object]) -> str:
    summary = manifest["summary"]
    assert isinstance(summary, dict)
    lines = [
        "# YukiLog 旧数据备份校验报告",
        "",
        f"- 清单格式：v{manifest['schema_version']}",
        f"- 生成时间：{manifest['generated_at']}",
        f"- 文件数：{summary['files']}",
        f"- 总大小：{summary['bytes']} bytes",
        f"- 整体 SHA-256：`{manifest['tree_sha256']}`",
        f"- 校验错误：{summary['errors']}",
        f"- 校验警告：{summary['warnings']}",
        "",
        "## 内容数量",
        "",
    ]
    content_items = summary["content_items"]
    assert isinstance(content_items, dict)
    for section, count in content_items.items():
        lines.append(f"- `{section}`：{count}")

    lines.extend(["", "## 外部资源域名", ""])
    external_domains = summary["external_domains"]
    assert isinstance(external_domains, dict)
    if external_domains:
        for domain, count in external_domains.items():
            lines.append(f"- `{domain}`：{count} 处引用")
    else:
        lines.append("- 未发现")

    series = summary["yukilog_series"]
    assert isinstance(series, list)
    lines.extend(
        [
            "",
            "## YukiLog 系列",
            "",
            f"- 编号文章：{', '.join(str(number) for number in series) or '未发现'}",
            "",
            "## 校验问题",
            "",
        ]
    )
    issues = manifest["issues"]
    assert isinstance(issues, list)
    if issues:
        for issue in issues:
            lines.append(
                f"- [{str(issue['severity']).upper()}] `{issue['path']}`：{issue['message']}"
            )
    else:
        lines.append("- 未发现结构或完整性问题")

    lines.extend(
        [
            "",
            "> 本报告仅记录结构、元数据摘要与校验值，不复制文章或随记正文。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="备份根目录")
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="manifest.json 与 report.md 的输出目录",
    )
    args = parser.parse_args()

    manifest = audit(args.source.resolve())
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output_dir / "manifest.json"
    report_path = args.output_dir / "report.md"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report_path.write_text(render_report(manifest), encoding="utf-8")

    summary = manifest["summary"]
    assert isinstance(summary, dict)
    print(f"manifest: {manifest_path}")
    print(f"report:   {report_path}")
    print(f"tree:     {manifest['tree_sha256']}")
    print(f"errors:   {summary['errors']}")
    print(f"warnings: {summary['warnings']}")
    return 1 if summary["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
