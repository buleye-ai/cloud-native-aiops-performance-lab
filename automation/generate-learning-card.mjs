import { randomBytes } from "node:crypto";

import { getArg } from "./lib.mjs";
import {
  escapeHtml,
  readJson,
  telegramApi,
  writeJson
} from "./telegram-sync-lib.mjs";

const kind = getArg("--kind");
if (!["industry", "english"].includes(kind)) {
  throw new Error("--kind 必须是 industry 或 english");
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID;
if (!adminUserId) throw new Error("缺少 TELEGRAM_ADMIN_USER_ID");

const aiProviders = [
  createProvider("primary", {
    apiKey: process.env.AI_PRIMARY_API_KEY,
    baseUrl: process.env.AI_PRIMARY_BASE_URL,
    model: process.env.AI_PRIMARY_MODEL
  }),
  createProvider("backup", {
    apiKey: process.env.AI_BACKUP_API_KEY,
    baseUrl: process.env.AI_BACKUP_BASE_URL,
    model: process.env.AI_BACKUP_MODEL
  }),
  createProvider("openai", {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl:
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra"
  })
].filter(Boolean);

if (!aiProviders.length) {
  throw new Error(
    "缺少 AI 配置：请设置主线路、备用线路或 OPENAI_API_KEY"
  );
}

const sourceStatePath = "publication/digest-state.json";
const sourceState = await readJson(sourceStatePath, { used_urls: [] });
const sourceItems = await collectSources();
const freshItems = sourceItems
  .filter((item) => !sourceState.used_urls.includes(item.url))
  .slice(0, 6);

if (!freshItems.length) {
  console.log("没有新的行业来源，跳过本次推送");
  process.exit(0);
}

const content = await generateWithFallback(kind, freshItems, aiProviders);
const id =
  `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const candidate = {
  id,
  kind,
  status: "pending",
  created_at: new Date().toISOString(),
  ...content,
  sources: freshItems.slice(0, 3)
};

const message = await telegramApi(
  "sendMessage",
  {
    chat_id: adminUserId,
    text: renderTelegramCard(candidate),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ 收录博客", callback_data: `approve:${id}` },
          { text: "❌ 忽略", callback_data: `reject:${id}` }
        ]
      ]
    }
  },
  telegramToken
);

candidate.telegram_message_id = message.message_id;
await writeJson(`publication/pending/${id}.json`, candidate);
sourceState.used_urls = [
  ...freshItems.map((item) => item.url),
  ...sourceState.used_urls
].slice(0, 200);
await writeJson(sourceStatePath, sourceState);

console.log(`candidate_id=${id} kind=${kind}`);

async function collectSources() {
  const feeds = [
    { name: "Kubernetes Blog", url: "https://kubernetes.io/feed.xml" },
    { name: "CNCF Blog", url: "https://www.cncf.io/feed/" },
    { name: "OpenAI News", url: "https://openai.com/news/rss.xml" }
  ];
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: { "user-agent": "cloud-native-aiops-performance-lab/1.0" }
      });
      if (!response.ok) throw new Error(`${feed.name}: ${response.status}`);
      return parseFeed(await response.text(), feed.name);
    })
  );

  for (const result of results) {
    if (result.status === "rejected") console.warn(result.reason.message);
  }

  return results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .sort(
      (left, right) =>
        new Date(right.published_at).getTime() -
        new Date(left.published_at).getTime()
    );
}

function parseFeed(xml, sourceName) {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ??
    [];
  return blocks.slice(0, 8).flatMap((block) => {
    const title = readTag(block, "title");
    const url =
      readTag(block, "link") ??
      block.match(/<link[^>]+href=["']([^"']+)/i)?.[1];
    const publishedAt =
      readTag(block, "pubDate") ??
      readTag(block, "published") ??
      readTag(block, "updated") ??
      new Date().toISOString();
    const summary =
      readTag(block, "description") ??
      readTag(block, "summary") ??
      readTag(block, "content") ??
      "";
    if (!title || !url) return [];
    return [
      {
        source: sourceName,
        title: cleanXml(title),
        url: cleanXml(url),
        published_at: new Date(publishedAt).toISOString(),
        summary: cleanXml(summary).slice(0, 900)
      }
    ];
  });
}

function readTag(block, tag) {
  return block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  )?.[1];
}

function cleanXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function createProvider(name, config) {
  const values = [config.apiKey, config.baseUrl, config.model];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    console.warn(`${name} AI 配置不完整，已跳过`);
    return null;
  }
  return {
    name,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl.replace(/\/+$/, ""),
    model: config.model
  };
}

async function generateWithFallback(cardKind, sources, providers) {
  const errors = [];
  for (const provider of providers) {
    try {
      const result = await generateWithProvider(cardKind, sources, provider);
      console.log(`ai_provider=${provider.name} ai_model=${provider.model}`);
      return result;
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
      console.warn(`AI 线路 ${provider.name} 失败，尝试下一线路：${error.message}`);
    }
  }
  throw new Error(`所有 AI 线路均失败：${errors.join(" | ")}`);
}

async function generateWithProvider(cardKind, sources, provider) {
  const objective =
    cardKind === "industry"
      ? "生成一份面向资深运维开发的云原生与 AI 行业双语简报"
      : "生成一份基于云原生行业材料的技术英语学习卡";
  const developerPrompt = `${objective}。只允许使用用户提供的来源事实，不得虚构版本、日期、数字或引用。
返回且只返回合法 JSON，结构必须是：
{"title":"中文标题","english":"80-140词英文摘要","chinese":"中文解释","why_it_matters":"与云原生、AIOps、Agent Infra或职业发展的关系","vocabulary":[{"term":"word","meaning":"中文","example":"英文例句"}],"interview_expression":"可在英文面试中使用的1-2句话"}
vocabulary 必须恰好包含 3 项。表达清楚、克制、可核查。`;

  const response = await fetch(`${provider.baseUrl}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      reasoning: { effort: "low" },
      text: { verbosity: "medium" },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: developerPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(sources)
            }
          ]
        }
      ]
    })
  });

  const result = await readResponseJson(response);
  if (!response.ok) {
    if (shouldTryChatCompletions(response.status, result)) {
      return generateWithChatCompletions(
        developerPrompt,
        sources,
        provider
      );
    }
    throw new Error(formatApiError(response.status, result));
  }
  const outputText = result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("Responses API 返回中没有 output_text");

  return parseGeneratedContent(outputText);
}

async function generateWithChatCompletions(
  developerPrompt,
  sources,
  provider
) {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: developerPrompt },
        { role: "user", content: JSON.stringify(sources) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });
  const result = await readResponseJson(response);
  if (!response.ok) throw new Error(formatApiError(response.status, result));
  const outputText = result.choices?.[0]?.message?.content;
  if (!outputText) {
    throw new Error("Chat Completions API 返回中没有 message.content");
  }
  return parseGeneratedContent(outputText);
}

function parseGeneratedContent(outputText) {
  const parsed = JSON.parse(
    outputText.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  );
  validateGeneratedContent(parsed);
  return normalizeGeneratedContent(parsed);
}

async function readResponseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 300) } };
  }
}

function shouldTryChatCompletions(status, result) {
  if ([404, 405, 501].includes(status)) return true;
  const message = String(result.error?.message ?? "").toLowerCase();
  return (
    message.includes("responses") &&
    (message.includes("not support") ||
      message.includes("unsupported") ||
      message.includes("not found"))
  );
}

function formatApiError(status, result) {
  return `HTTP ${status}：${result.error?.message ?? "未知 API 错误"}`;
}

function validateGeneratedContent(value) {
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

function normalizeGeneratedContent(value) {
  return {
    title: limit(value.title, 100),
    english: limit(value.english, 1200),
    chinese: limit(value.chinese, 1000),
    why_it_matters: limit(value.why_it_matters, 700),
    interview_expression: limit(value.interview_expression, 500),
    vocabulary: value.vocabulary.map((item) => ({
      term: limit(item.term, 80),
      meaning: limit(item.meaning, 120),
      example: limit(item.example, 240)
    }))
  };
}

function limit(value, maximum) {
  const text = String(value).trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function renderTelegramCard(candidate) {
  const heading =
    candidate.kind === "industry"
      ? "🌍 <b>行业双语简报候选</b>"
      : "📚 <b>技术英语学习候选</b>";
  const words = candidate.vocabulary
    .map(
      (item) =>
        `• <b>${escapeHtml(item.term)}</b>：${escapeHtml(item.meaning)}`
    )
    .join("\n");
  const sources = candidate.sources
    .map(
      (source) =>
        `• <a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>`
    )
    .join("\n");

  return `${heading}

<b>${escapeHtml(candidate.title)}</b>

<b>English</b>
${escapeHtml(candidate.english)}

<b>中文理解</b>
${escapeHtml(candidate.chinese)}

<b>为什么值得关注</b>
${escapeHtml(candidate.why_it_matters)}

<b>今日词汇</b>
${words}

<b>面试表达</b>
${escapeHtml(candidate.interview_expression)}

<b>来源</b>
${sources}`;
}
