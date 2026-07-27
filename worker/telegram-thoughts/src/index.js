const DEFAULT_CONFIG = {
  channelUsername: "FrogsAndDucks",
  githubOwner: "buleye-ai",
  githubRepo: "cloud-native-aiops-performance-lab",
  githubBranch: "main",
  markers: ["#思考", "#面试"]
};

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return json({
        ok: true,
        service: "telegram-thoughts",
        markers: getConfig(env).markers
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }

    if (!isAuthorizedTelegramRequest(request, env)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    try {
      const result = await processTelegramUpdate(update, env);
      return json({ ok: true, ...result });
    } catch (error) {
      console.error(error);
      return json(
        { ok: false, error: error instanceof Error ? error.message : "unknown" },
        500
      );
    }
  }
};

export async function processTelegramUpdate(update, env) {
  const message = update.channel_post;
  if (!message) return { ignored: "not_a_new_channel_post" };

  const config = getConfig(env);
  const username = message.chat?.username?.toLowerCase();
  if (username !== config.channelUsername.toLowerCase()) {
    return { ignored: "unexpected_channel" };
  }

  const source = message.text ?? message.caption ?? "";
  const matchedMarker = config.markers.find((marker) => source.includes(marker));
  if (!matchedMarker) {
    return { ignored: "marker_not_found" };
  }

  const body = cleanThought(source, matchedMarker);
  if (!body) return { ignored: "empty_thought" };

  const publishedAt = new Date(message.date * 1000);
  const dateParts = shanghaiDateParts(publishedAt);
  const path =
    `docs/thoughts/${dateParts.year}/${dateParts.month}/` +
    `${dateParts.date}-telegram-${message.message_id}.md`;
  const telegramUrl =
    `https://t.me/${config.channelUsername}/${message.message_id}`;
  const title = deriveTitle(body);
  const markdown = renderMarkdown({
    title,
    body,
    publishedAt,
    messageId: message.message_id,
    telegramUrl,
    tag: matchedMarker.slice(1)
  });

  const result = await createGitHubFile({
    env,
    config,
    path,
    markdown,
    messageId: message.message_id
  });

  return {
    created: result.created,
    duplicate: result.duplicate,
    path,
    telegram_url: telegramUrl
  };
}

function getConfig(env) {
  return {
    channelUsername:
      env.TELEGRAM_CHANNEL_USERNAME ?? DEFAULT_CONFIG.channelUsername,
    githubOwner: env.GITHUB_OWNER ?? DEFAULT_CONFIG.githubOwner,
    githubRepo: env.GITHUB_REPO ?? DEFAULT_CONFIG.githubRepo,
    githubBranch: env.GITHUB_BRANCH ?? DEFAULT_CONFIG.githubBranch,
    markers: (env.THOUGHT_MARKERS ?? DEFAULT_CONFIG.markers.join(","))
      .split(",")
      .map((marker) => marker.trim())
      .filter(Boolean)
  };
}

function isAuthorizedTelegramRequest(request, env) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return (
    request.headers.get("X-Telegram-Bot-Api-Secret-Token") === expected
  );
}

function cleanThought(source, marker) {
  return source
    .replace(marker, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 12000);
}

function deriveTitle(body) {
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "Telegram 思考";
  return firstLine
    .replace(/^#+\s*/, "")
    .replace(/[*_`[\]]/g, "")
    .slice(0, 72);
}

function shanghaiDateParts(date) {
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
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function renderMarkdown({
  title,
  body,
  publishedAt,
  messageId,
  telegramUrl,
  tag
}) {
  return `---
title: ${JSON.stringify(title)}
date: ${JSON.stringify(publishedAt.toISOString())}
tags:
  - ${tag}
source: telegram
telegram_message_id: ${messageId}
telegram_url: ${JSON.stringify(telegramUrl)}
---

${body}

---

[查看 Telegram 原文](${telegramUrl})
`;
}

async function createGitHubFile({
  env,
  config,
  path,
  markdown,
  messageId
}) {
  if (!env.GITHUB_TOKEN) throw new Error("missing_github_token");

  const endpoint =
    `https://api.github.com/repos/${config.githubOwner}/` +
    `${config.githubRepo}/contents/${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "telegram-thoughts-worker",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const existing = await fetch(
    `${endpoint}?ref=${encodeURIComponent(config.githubBranch)}`,
    { headers }
  );
  if (existing.ok) return { created: false, duplicate: true };
  if (existing.status !== 404) {
    throw new Error(`github_lookup_failed_${existing.status}`);
  }

  const response = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `content: import Telegram thought ${messageId}`,
      content: encodeBase64(markdown),
      branch: config.githubBranch
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(detail);
    throw new Error(`github_create_failed_${response.status}`);
  }

  return { created: true, duplicate: false };
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
