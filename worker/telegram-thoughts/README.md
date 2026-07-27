# Telegram Thoughts Worker

把 Telegram 公开频道 `@FrogsAndDucks` 中带有 `#思考` 的新消息转换为 Markdown，并写入博客仓库。

## 数据流

```text
Telegram channel_post
→ Cloudflare Worker
→ GitHub Contents API
→ docs/thoughts/YYYY/MM/*.md
→ GitHub Pages
```

## Secrets

以下值只能配置为 Cloudflare Worker Secrets，禁止提交到仓库：

- `GITHUB_TOKEN`：仅授权目标仓库 `Contents: Read and write`。
- `TELEGRAM_WEBHOOK_SECRET`：用于验证 Telegram Webhook 请求。

设置 Telegram Webhook 时还需要 Bot Token，但 Worker 不需要读取 Bot Token。

## 消息格式

```text
#思考

排障不是从命令开始，而是从可证伪的假设开始。
```

不包含 `#思考` 的频道消息会返回成功但不写入 GitHub。相同 Telegram 消息 ID 只会创建一次文件。

## 当前边界

- 只处理新的 `channel_post`，不会自动导入历史消息。
- 支持纯文本和媒体 caption。
- 第一版不下载 Telegram 图片，博客保留原消息链接。
- 编辑已有 Telegram 消息不会修改已经生成的 Markdown。
