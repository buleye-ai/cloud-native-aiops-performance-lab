import assert from "node:assert/strict";
import test from "node:test";

import { processTelegramUpdate } from "../src/index.js";

const env = {
  GITHUB_TOKEN: "test-token",
  TELEGRAM_CHANNEL_USERNAME: "FrogsAndDucks",
  THOUGHT_MARKER: "#思考"
};

test("忽略没有 #思考 标记的频道消息", async () => {
  const result = await processTelegramUpdate(
    {
      channel_post: {
        message_id: 10,
        date: 1785174400,
        chat: { username: "FrogsAndDucks" },
        text: "普通频道通知"
      }
    },
    env
  );

  assert.deepEqual(result, { ignored: "marker_not_found" });
});

test("把带标记的频道消息写入确定的 Markdown 路径", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (!options.method) return new Response("not found", { status: 404 });
    return Response.json({ content: { path: "created" } }, { status: 201 });
  };

  try {
    const result = await processTelegramUpdate(
      {
        channel_post: {
          message_id: 123,
          date: 1785174400,
          chat: { username: "FrogsAndDucks" },
          text: "#思考\n\n排障不是从命令开始，而是从假设开始。"
        }
      },
      env
    );

    assert.equal(result.created, true);
    assert.equal(result.duplicate, false);
    assert.match(result.path, /telegram-123\.md$/);
    assert.equal(requests.length, 2);

    const payload = JSON.parse(requests[1].options.body);
    const markdown = Buffer.from(payload.content, "base64").toString("utf8");
    assert.match(markdown, /title: "排障不是从命令开始，而是从假设开始。"/);
    assert.match(markdown, /telegram_message_id: 123/);
    assert.doesNotMatch(markdown, /#思考/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
