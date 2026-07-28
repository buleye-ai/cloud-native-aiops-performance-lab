import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "./lib.mjs";

export const TELEGRAM_CHANNEL = "FrogsAndDucks";
export const TRIGGERS = ["#思考", "#面试"];
export const AI_COMMANDS = {
  "#总结": "summary",
  "#写作": "writing",
  "#复盘": "retrospective",
  "#见解": "insight"
};
export const BOT_COMMANDS = [
  { command: "help", description: "查看全部功能和使用示例" },
  { command: "features", description: "查看频道触发词" }
];
export const FEATURE_HELP_TEXT = `<b>Cloud Native AI 学习助手</b>

<b>直接收录</b>
<code>#思考 内容</code> — 记录到思考日志
<code>#面试 内容</code> — 记录面试素材

<b>生成候选（私聊审核后发布）</b>
<code>#总结 URL或材料</code> — 提炼事实和结论
<code>#写作 主题或材料</code> — 生成技术文章
<code>#复盘 事故记录</code> — 整理根因、改进和 SOP
<code>#见解 主题或材料</code> — 分析正反观点和生产影响

<b>机器人私聊</b>
<code>/help</code> 或 <code>/features</code> — 随时查看本清单

<b>每日英语阅读</b>
08:00 — 日常、通勤和工作英语
20:30 — 生活、文化和通识英语
难度从 A2 逐步提升到 A2+、B1，直接发送到本私聊。

使用方式：把以触发词开头的内容发到 @FrogsAndDucks。AI 内容会先发送到本私聊，由你选择“收录博客”或“忽略”。`;

export async function telegramApi(method, payload, token) {
  if (!token) throw new Error("缺少 TELEGRAM_BOT_TOKEN");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }
  );
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram ${method} 失败：${result.description ?? response.status}`
    );
  }
  return result.result;
}

export async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(
      await readFile(path.join(projectRoot, relativePath), "utf8")
    );
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(relativePath, value) {
  const target = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeMarkdown(relativePath, markdown) {
  const target = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, markdown);
}

export function shanghaiDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function yamlString(value) {
  return JSON.stringify(String(value));
}
