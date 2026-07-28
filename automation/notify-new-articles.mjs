import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  hasFlag,
  listMarkdownFiles,
  loadArticle,
  projectRoot,
  sendTelegram,
  telegramHtml
} from "./lib.mjs";
import { readJson, writeJson } from "./telegram-sync-lib.mjs";

const dryRun = hasFlag("--dry-run");
const statePath = "publication/article-notifications.json";
const state = await readJson(statePath, { articles: {} });
const markdownFiles = await listMarkdownFiles();
const candidates = [];

for (const absolutePath of markdownFiles) {
  const markdown = await readFile(absolutePath, "utf8");
  const frontmatter = parseFrontmatter(markdown);
  if (frontmatter.telegram_publish !== "true") continue;

  const relativePath = path
    .relative(projectRoot, absolutePath)
    .replaceAll(path.sep, "/");
  const version = positiveInteger(frontmatter.telegram_version ?? "1");
  const publishedVersion = state.articles[relativePath]?.version ?? 0;
  if (publishedVersion >= version) continue;
  candidates.push({ relativePath, version });
}

if (!candidates.length) {
  console.log("没有需要通知 Channel 的新文章");
  process.exit(0);
}

for (const candidate of candidates) {
  const article = await loadArticle(candidate.relativePath);
  if (dryRun) {
    console.log(
      `dry_run article=${candidate.relativePath} version=${candidate.version}`
    );
    console.log(telegramHtml(article));
    continue;
  }

  const message = await sendTelegram(telegramHtml(article));
  state.articles[candidate.relativePath] = {
    version: candidate.version,
    telegram_message_id: message.message_id,
    channel_url: `https://t.me/FrogsAndDucks/${message.message_id}`,
    notified_at: new Date().toISOString(),
    content_sha256: article.hash
  };
  await writeJson(statePath, state);
  console.log(
    `notified article=${candidate.relativePath} ` +
      `version=${candidate.version} message_id=${message.message_id}`
  );
}

function parseFrontmatter(markdown) {
  const block = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!block) return {};
  return Object.fromEntries(
    block.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*?)\s*$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^["']|["']$/g, "")]];
    })
  );
}

function positiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`telegram_version 必须是正整数，当前值：${value}`);
  }
  return parsed;
}
