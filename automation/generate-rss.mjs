import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  articleUrl,
  listMarkdownFiles,
  parseArticle,
  projectRoot
} from "./lib.mjs";

const outputFile = path.join(projectRoot, "docs/public/feed.xml");
const siteUrl = (process.env.BLOG_BASE_URL ?? "https://ai.buleye.com").replace(/\/$/, "");

const items = [];

for (const absolutePath of await listMarkdownFiles()) {
  const markdown = await readFile(absolutePath, "utf8");
  const frontmatter = parseFrontmatter(markdown);

  if (frontmatter.rss_publish !== "true") continue;

  const publishedAt = new Date(frontmatter.date);
  if (!frontmatter.date || Number.isNaN(publishedAt.getTime())) {
    throw new Error(`${absolutePath} 启用了 rss_publish，但缺少有效的 date`);
  }

  const article = parseArticle(markdown, absolutePath);
  items.push({
    ...article,
    title: frontmatter.title ?? article.title,
    summary: frontmatter.description ?? article.summary,
    publishedAt,
    url: articleUrl(article.relativePath)
  });
}

items.sort((a, b) => b.publishedAt - a.publishedAt);

const lastBuildDate = items[0]?.publishedAt ?? new Date("2026-01-01T00:00:00Z");
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cloud Native AIOps Performance Lab</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Linux 性能、云原生、可观测性与 AI 工程实战文章</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items.slice(0, 50).map(renderItem).join("\n")}
  </channel>
</rss>
`;

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, xml, "utf8");
console.log(`RSS 已生成：${items.length} 篇文章 -> ${outputFile}`);

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((entry) => [entry[1], entry[2].replace(/^(["'])(.*)\1$/, "$2")])
  );
}

function renderItem(item) {
  return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${item.publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(item.summary)}</description>
    </item>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
