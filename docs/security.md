# 安全配置

## Telegram

在 GitHub 仓库中进入：

```text
Settings → Secrets and variables → Actions → New repository secret
```

创建：

- `TELEGRAM_BOT_TOKEN`：BotFather 返回的 Token；
- `TELEGRAM_CHAT_ID`：`@FrogsAndDucks`。

不要把真实值写入 `.env.example`、工作流、Issue、Actions 日志或文章。

## 发布权限

第一版 Telegram 工作流仅支持手动触发，并默认 `dry_run=true`。只有手动关闭 Dry Run 时才会调用 Telegram API。

## 内容安全

- 生产日志必须脱敏；
- pcap 不进入公开仓库；
- 不记录公司域名、IP、Token、用户信息；
- 课程内容只保留自己的总结、实验和观点。

