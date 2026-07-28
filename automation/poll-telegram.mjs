import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "./lib.mjs";
import {
  generateJsonWithFallback,
  loadAiProviders
} from "./ai-client.mjs";
import {
  AI_COMMANDS,
  BOT_COMMANDS,
  FEATURE_HELP_TEXT,
  TELEGRAM_CHANNEL,
  TRIGGERS,
  escapeHtml,
  readJson,
  shanghaiDateParts,
  telegramApi,
  writeJson,
  writeMarkdown,
  yamlString
} from "./telegram-sync-lib.mjs";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID;
const channelChatId = process.env.TELEGRAM_CHAT_ID;
const statePath = "publication/telegram-state.json";
const state = await readJson(statePath, { offset: 0 });

await configureBotMenu();
if ((state.help_version ?? 0) < 1) {
  await sendFeatureHelp();
  state.help_version = 1;
}
const updates = await telegramApi(
  "getUpdates",
  {
    offset: state.offset,
    limit: 100,
    timeout: 0,
    allowed_updates: ["message", "channel_post", "callback_query"]
  },
  token
);

for (const update of updates) {
  if (update.message) await handlePrivateMessage(update.message);
  if (update.channel_post) await importChannelPost(update.channel_post);
  if (update.callback_query) await processApproval(update.callback_query);
  state.offset = Math.max(state.offset, update.update_id + 1);
}

await reconcileApprovedChannelPosts();
await writeJson(statePath, state);
console.log(`processed_updates=${updates.length} next_offset=${state.offset}`);

async function importChannelPost(message) {
  if (message.chat?.username?.toLowerCase() !== TELEGRAM_CHANNEL.toLowerCase()) {
    return;
  }

  const source = message.text ?? message.caption ?? "";
  if (source.trimStart().startsWith("#帮助")) {
    await sendFeatureHelp();
    return;
  }
  const command = Object.keys(AI_COMMANDS).find((candidate) =>
    source.trimStart().startsWith(candidate)
  );
  if (command) {
    await createAiCandidate(message, command, source);
    return;
  }
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

async function configureBotMenu() {
  try {
    await telegramApi(
      "setMyCommands",
      {
        commands: BOT_COMMANDS,
        scope: { type: "all_private_chats" }
      },
      token
    );
    await telegramApi(
      "setChatMenuButton",
      {
        chat_id: adminUserId,
        menu_button: { type: "commands" }
      },
      token
    );
  } catch (error) {
    console.warn(`配置 Telegram 菜单失败，继续同步：${error.message}`);
  }
}

async function handlePrivateMessage(message) {
  if (message.chat?.type !== "private") return;
  if (!adminUserId || String(message.from?.id) !== String(adminUserId)) return;
  const command = String(message.text ?? "")
    .trim()
    .split(/\s+/)[0]
    .split("@")[0]
    .toLowerCase();
  if (["/start", "/help", "/features"].includes(command)) {
    await sendFeatureHelp(message.chat.id);
  }
}

async function sendFeatureHelp(chatId = adminUserId) {
  if (!chatId) throw new Error("缺少 TELEGRAM_ADMIN_USER_ID");
  await telegramApi(
    "sendMessage",
    {
      chat_id: chatId,
      text: FEATURE_HELP_TEXT,
      parse_mode: "HTML",
      disable_web_page_preview: true
    },
    token
  );
}

async function createAiCandidate(message, command, source) {
  const id = `tg-${message.message_id}`;
  const pendingPath = `publication/pending/${id}.json`;
  if (await exists(pendingPath)) return;

  const request = source.trimStart().slice(command.length).trim();
  if (!request) {
    console.warn(`${command} 缺少需要处理的内容`);
    return;
  }

  const kind = AI_COMMANDS[command];
  const material = await expandUrlMaterial(request);
  const generated = await generateJsonWithFallback({
    providers: loadAiProviders(),
    developerPrompt: buildCommandPrompt(kind),
    userInput: material
  });
  validateAiCandidate(generated);

  const createdAt = new Date(message.date * 1000).toISOString();
  const telegramUrl =
    `https://t.me/${TELEGRAM_CHANNEL}/${message.message_id}`;
  const candidate = {
    id,
    kind,
    status: "pending",
    created_at: createdAt,
    title: limit(generated.title, 100),
    english: limit(generated.english, 1200),
    chinese: limit(generated.chinese, 3000),
    why_it_matters: limit(generated.why_it_matters, 1200),
    interview_expression: limit(generated.interview_expression, 700),
    vocabulary: generated.vocabulary.map((item) => ({
      term: limit(item.term, 80),
      meaning: limit(item.meaning, 140),
      example: limit(item.example, 260)
    })),
    sources: [
      {
        source: "Telegram Channel",
        title: `${command} 原始指令`,
        url: telegramUrl,
        published_at: createdAt
      }
    ],
    telegram_source_message_id: message.message_id
  };

  const sent = await telegramApi(
    "sendMessage",
    {
      chat_id: adminUserId,
      text: renderAiCandidate(candidate, command),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ 博客 + Channel", callback_data: `approve:${id}` },
            { text: "❌ 忽略", callback_data: `reject:${id}` }
          ]
        ]
      }
    },
    token
  );
  candidate.telegram_message_id = sent.message_id;
  await writeJson(pendingPath, candidate);
}

async function reconcileApprovedChannelPosts() {
  if (!channelChatId) {
    console.warn("缺少 TELEGRAM_CHAT_ID，跳过 Channel 补发");
    return;
  }
  const eligibleKinds = new Set([
    "summary",
    "writing",
    "retrospective",
    "insight"
  ]);
  let names = [];
  try {
    names = await readdir(path.join(projectRoot, "publication/pending"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const name of names.filter((item) => item.endsWith(".json"))) {
    const relativePath = `publication/pending/${name}`;
    const candidate = await readJson(relativePath, null);
    if (
      !candidate ||
      candidate.status !== "approved" ||
      !candidate.blog_path ||
      candidate.channel_message_id ||
      !eligibleKinds.has(candidate.kind)
    ) {
      continue;
    }
    try {
      const message = await publishCandidateToChannel(candidate);
      candidate.channel_message_id = message.message_id;
      candidate.channel_published_at = new Date().toISOString();
      candidate.channel_url =
        `https://t.me/${TELEGRAM_CHANNEL}/${message.message_id}`;
      delete candidate.channel_publish_error;
    } catch (error) {
      candidate.channel_publish_error = error.message.slice(0, 500);
      console.warn(`Channel 补发失败，保留待重试状态：${error.message}`);
    }
    await writeJson(relativePath, candidate);
  }
}

async function publishCandidateToChannel(candidate) {
  const typeLabels = {
    summary: "总结",
    writing: "文章",
    retrospective: "复盘",
    insight: "见解"
  };
  const blogUrl =
    `https://ai.buleye.com/` +
    candidate.blog_path
      .replace(/^docs\//, "")
      .replace(/\.md$/, "");
  const text = [
    `🧠 <b>${typeLabels[candidate.kind] ?? "学习"} · ${escapeHtml(candidate.title)}</b>`,
    "",
    escapeHtml(limit(candidate.chinese, 2200)),
    "",
    "<b>为什么值得关注</b>",
    escapeHtml(limit(candidate.why_it_matters, 700)),
    "",
    `<a href="${escapeHtml(blogUrl)}">阅读全文与学习笔记</a>`
  ].join("\n");
  return telegramApi(
    "sendMessage",
    {
      chat_id: channelChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false
    },
    token
  );
}

function buildCommandPrompt(kind) {
  const objectives = {
    summary: "总结材料，区分事实、观点和待验证信息，提炼核心结论",
    writing: "将材料写成结构清晰、可复习的技术文章",
    retrospective:
      "将材料整理成生产复盘，覆盖现象、影响、时间线、根因、处置、改进和 SOP",
    insight:
      "给出有依据的独立见解，包含正反观点、关键假设、生产影响和可执行建议"
  };
  return `你是资深云原生、性能工程与 AIOps 编辑。任务：${objectives[kind]}。
面向有多年运维开发经验的读者，不讲空话；明确说明问题、原理、失败方式、生产取舍，以及与云原生 AI 职业能力的联系。
不得把推测写成事实，不得虚构来源、版本、日期、数据或案例。
只返回合法 JSON：
{"title":"标题","english":"80-140词英文摘要","chinese":"中文正文","why_it_matters":"生产价值与职业联系","vocabulary":[{"term":"英文术语","meaning":"中文含义","example":"英文例句"}],"interview_expression":"1-2句可用于面试的英文表达"}
vocabulary 必须恰好为 3 项。`;
}

async function expandUrlMaterial(request) {
  const url = request.match(/https?:\/\/[^\s]+/)?.[0];
  if (!url) return request.slice(0, 12000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "cloud-native-aiops-performance-lab/1.0" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/")) {
      throw new Error(`不支持的内容类型 ${contentType}`);
    }
    const text = (await response.text())
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30000);
    return `用户要求：${request}\n\n链接正文：${text}`;
  } catch (error) {
    console.warn(`读取链接失败，改用原始指令：${error.message}`);
    return request.slice(0, 12000);
  }
}

function validateAiCandidate(value) {
  for (const field of [
    "title",
    "english",
    "chinese",
    "why_it_matters",
    "interview_expression"
  ]) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new Error(`AI 输出缺少字段：${field}`);
    }
  }
  if (!Array.isArray(value.vocabulary) || value.vocabulary.length !== 3) {
    throw new Error("AI 输出 vocabulary 必须包含 3 项");
  }
}

function renderAiCandidate(candidate, command) {
  const words = candidate.vocabulary
    .map((item) => `• <b>${escapeHtml(item.term)}</b>：${escapeHtml(item.meaning)}`)
    .join("\n");
  return [
    `🧠 <b>${escapeHtml(command)} 候选</b>`,
    "",
    `<b>${escapeHtml(candidate.title)}</b>`,
    "",
    escapeHtml(limit(candidate.chinese, 1200)),
    "",
    `<b>为什么值得关注</b>`,
    escapeHtml(limit(candidate.why_it_matters, 600)),
    "",
    `<b>术语</b>`,
    words
  ].join("\n");
}

function limit(value, maximum) {
  const text = String(value).trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
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
  const tags = {
    industry: "行业",
    english: "英语",
    summary: "总结",
    writing: "写作",
    retrospective: "复盘",
    insight: "见解"
  };
  const tag = tags[candidate.kind] ?? "学习";

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
