import {
  getArg,
  hasFlag,
  loadArticle,
  sendTelegram,
  telegramHtml
} from "./lib.mjs";

const file = getArg("--file");
const dryRun = hasFlag("--dry-run");

if (!file) {
  console.error(
    "用法：node automation/publish-telegram.mjs --file docs/.../article.md [--dry-run]"
  );
  process.exit(1);
}

const article = await loadArticle(file);
const message = telegramHtml(article);

if (dryRun) {
  console.log("=== Telegram Dry Run ===");
  console.log(message);
  console.log(`\ncontent_sha256=${article.hash}`);
  process.exit(0);
}

const result = await sendTelegram(message);
console.log(
  JSON.stringify(
    {
      ok: true,
      chat_id: result.chat.id,
      message_id: result.message_id,
      article: article.relativePath,
      hash: article.hash
    },
    null,
    2
  )
);

