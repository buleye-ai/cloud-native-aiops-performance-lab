import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "./lib.mjs";

export const TELEGRAM_CHANNEL = "FrogsAndDucks";
export const TRIGGERS = ["#思考", "#面试"];

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
