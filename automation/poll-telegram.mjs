import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "./lib.mjs";
import {
  TELEGRAM_CHANNEL,
  TRIGGERS,
  readJson,
  shanghaiDateParts,
  telegramApi,
  writeJson,
  writeMarkdown,
  yamlString
} from "./telegram-sync-lib.mjs";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID;
const statePath = "publication/telegram-state.json";
const state = await readJson(statePath, { offset: 0 });

const updates = await telegramApi(
  "getUpdates",
  {
    offset: state.offset,
    limit: 100,
    timeout: 0,
    allowed_updates: ["channel_post", "callback_query"]
  },
  token
);

for (const update of updates) {
  if (update.channel_post) await importChannelPost(update.channel_post);
  if (update.callback_query) await processApproval(update.callback_query);
  state.offset = Math.max(state.offset, update.update_id + 1);
}

await writeJson(statePath, state);
console.log(`processed_updates=${updates.length} next_offset=${state.offset}`);

async function importChannelPost(message) {
  if (message.chat?.username?.toLowerCase() !== TELEGRAM_CHANNEL.toLowerCase()) {
    return;
  }

  const source = message.text ?? message.caption ?? "";
  const trigger = TRIGGERS.find((candidate) => source.includes(candidate));
  if (!trigger) return;

  const body = source.replace(trigger, "").trim().slice(0, 12000);
  if (!body) return;

  const publishedAt = new Date(message.date * 1000);
  const date = shanghaiDateParts(publishedAt);
  const relativePath =
    `docs/thoughts/${date.year}/${date.month}/` +
    `${date.date}-telegram-${message.message_id}.md`;
  if (await exists(relativePath)) return;

  const title =
    body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean)
      ?.replace(/^#+\s*/, "")
      .slice(0, 72) ?? "Telegram 记录";
  const telegramUrl =
    `https://t.me/${TELEGRAM_CHANNEL}/${message.message_id}`;

  await writeMarkdown(
    relativePath,
    `---
title: ${yamlString(title)}
date: ${yamlString(publishedAt.toISOString())}
tags:
  - ${trigger.slice(1)}
source: telegram
telegram_message_id: ${message.message_id}
telegram_url: ${yamlString(telegramUrl)}
---

${body}

---

[查看 Telegram 原文](${telegramUrl})
`
  );
}

async function processApproval(callback) {
  if (!adminUserId || String(callback.from?.id) !== String(adminUserId)) {
    await answerCallback(callback, "无权执行此操作", true);
    return;
  }

  const [action, id] = String(callback.data ?? "").split(":");
  if (!["approve", "reject"].includes(action) || !/^[a-z0-9-]+$/.test(id)) {
    return;
  }

  const pendingPath = `publication/pending/${id}.json`;
  const candidate = await readJson(pendingPath, null);
  if (!candidate) {
    await answerCallback(callback, "候选内容不存在或已经清理");
    return;
  }

  if (candidate.status !== "pending") {
    await answerCallback(callback, "这条内容已经处理");
    return;
  }

  candidate.status = action === "approve" ? "approved" : "rejected";
  candidate.reviewed_at = new Date().toISOString();

  if (action === "approve") {
    const blogPath = await publishLearningCard(candidate);
    candidate.blog_path = blogPath;
  }

  await writeJson(pendingPath, candidate);
  await answerCallback(
    callback,
    action === "approve" ? "已收录到博客" : "已忽略"
  );
  await telegramApi(
    "editMessageReplyMarkup",
    {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] }
    },
    token
  );
}

async function answerCallback(callback, text, showAlert = false) {
  try {
    await telegramApi(
      "answerCallbackQuery",
      {
        callback_query_id: callback.id,
        text,
        show_alert: showAlert
      },
      token
    );
  } catch (error) {
    if (
      error.message.includes("query is too old") ||
      error.message.includes("query ID is invalid")
    ) {
      console.warn("Telegram 回调提示已过期，继续处理内容状态");
      return;
    }
    throw error;
  }
}

async function publishLearningCard(candidate) {
  const date = shanghaiDateParts(candidate.created_at);
  const relativePath =
    `docs/learning/${date.year}/${date.month}/` +
    `${date.date}-${candidate.kind}-${candidate.id}.md`;
  if (await exists(relativePath)) return relativePath;

  const vocabulary = candidate.vocabulary
    .map(
      (item) =>
        `| ${escapeTable(item.term)} | ${escapeTable(item.meaning)} | ` +
        `${escapeTable(item.example)} |`
    )
    .join("\n");
  const sources = candidate.sources
    .map(
      (source) =>
        `- [${source.title}](${source.url})` +
        (source.published_at ? `（${source.published_at}）` : "")
    )
    .join("\n");
  const tag = candidate.kind === "industry" ? "行业" : "英语";

  await writeMarkdown(
    relativePath,
    `---
title: ${yamlString(candidate.title)}
date: ${yamlString(candidate.created_at)}
tags:
  - ${tag}
  - 云原生
source: ai-curated
telegram_candidate_id: ${yamlString(candidate.id)}
---

# ${candidate.title}

## English

${candidate.english}

## 中文理解

${candidate.chinese}

## 为什么值得关注

${candidate.why_it_matters}

## 今日词汇

| Word | 中文 | Example |
| --- | --- | --- |
${vocabulary}

## 面试表达

> ${candidate.interview_expression}

## 来源

${sources}

> 本文由 AI 基于上述来源整理，并经人工确认后收录。
`
  );
  return relativePath;
}

async function exists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
