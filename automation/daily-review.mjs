import { readFile } from "node:fs/promises";
import {
  hasFlag,
  listMarkdownFiles,
  parseArticle,
  sendTelegram,
  telegramHtml
} from "./lib.mjs";

const dryRun = hasFlag("--dry-run");
const files = (await listMarkdownFiles("docs/performance-engineering")).filter(
  (file) => !file.endsWith("index.md")
);

if (!files.length) throw new Error("没有找到可复习文章");

const dateKey = new Date().toISOString().slice(0, 10);
const seed = [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
const file = files[seed % files.length];
const article = parseArticle(await readFile(file, "utf8"), file);
const message = `🧠 <b>今日复习</b>\n\n${telegramHtml(article)}`;

if (dryRun) {
  console.log("=== Daily Review Dry Run ===");
  console.log(message);
  process.exit(0);
}

const result = await sendTelegram(message);
console.log(
  JSON.stringify(
    {
      ok: true,
      message_id: result.message_id,
      article: article.relativePath
    },
    null,
    2
  )
);

