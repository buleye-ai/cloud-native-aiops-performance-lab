import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export async function listMarkdownFiles(directory = "docs") {
  const root = path.resolve(projectRoot, directory);
  const result = [];

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      if (entry.isFile() && entry.name.endsWith(".md")) result.push(target);
    }
  }

  await walk(root);
  return result.sort();
}

export function parseArticle(markdown, absolutePath) {
  const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const title =
    withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
    path.basename(absolutePath, ".md");

  const blocks = withoutFrontmatter
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const summary =
    blocks.find(
      (block) =>
        !block.startsWith("#") &&
        !block.startsWith("|") &&
        !block.startsWith("```") &&
        block.length >= 20
    ) ?? "打开文章查看完整内容。";

  const bullets = withoutFrontmatter
    .split("\n")
    .filter((line) => /^[-*]\s+/.test(line))
    .slice(0, 3)
    .map((line) => line.replace(/^[-*]\s+/, "").trim());

  const relativePath = path
    .relative(path.join(projectRoot, "docs"), absolutePath)
    .replaceAll(path.sep, "/");

  return {
    title,
    summary: stripMarkdown(summary),
    bullets: bullets.map(stripMarkdown),
    relativePath,
    hash: createHash("sha256").update(markdown).digest("hex")
  };
}

export async function loadArticle(file) {
  const absolutePath = path.resolve(projectRoot, file);
  if (!absolutePath.startsWith(path.join(projectRoot, "docs") + path.sep)) {
    throw new Error("文章必须位于 docs/ 目录中");
  }
  const markdown = await readFile(absolutePath, "utf8");
  return parseArticle(markdown, absolutePath);
}

export function articleUrl(relativePath) {
  const base = (
    process.env.BLOG_BASE_URL ??
    "https://ai.buleye.com"
  ).replace(/\/$/, "");

  const cleanPath = relativePath
    .replace(/README\.md$/i, "")
    .replace(/index\.md$/i, "")
    .replace(/\.md$/i, "");

  return `${base}/${cleanPath}`;
}

export function telegramHtml(article) {
  const details = article.bullets.length
    ? `\n\n<b>核心要点</b>\n${article.bullets
        .map((item) => `• ${escapeHtml(item)}`)
        .join("\n")}`
    : "";

  return [
    `📘 <b>${escapeHtml(article.title)}</b>`,
    "",
    escapeHtml(truncate(article.summary, 700)),
    details,
    "",
    `🔗 <a href="${escapeHtml(articleUrl(article.relativePath))}">阅读完整文章</a>`,
    "",
    "#Linux #CloudNative #AIOps #Performance"
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export async function sendTelegram(html) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "@FrogsAndDucks";

  if (!token) throw new Error("缺少 TELEGRAM_BOT_TOKEN");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram 发布失败：${result.description ?? response.status}`);
  }

  return result.result;
}

export function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

function stripMarkdown(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
