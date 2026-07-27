<script setup lang="ts">
import { data as thoughts } from "../../thoughts.data.mts";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
</script>

<template>
  <div v-if="thoughts.length" class="thought-timeline">
    <article v-for="thought in thoughts" :key="thought.url" class="thought-card">
      <time :datetime="thought.date">{{ formatDate(thought.date) }}</time>
      <h2>
        <a :href="thought.url">{{ thought.title }}</a>
      </h2>
      <div class="thought-summary" v-html="thought.summary" />
      <div class="thought-meta">
        <span v-for="tag in thought.tags" :key="tag" class="thought-tag">
          #{{ tag }}
        </span>
        <a
          :href="thought.telegramUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看 Telegram 原文
        </a>
      </div>
    </article>
  </div>
  <div v-else class="thought-empty">
    暂无思考日志。在 Telegram 频道发布带有 <code>#思考</code> 的消息后，
    它会自动出现在这里。
  </div>
</template>

<style scoped>
.thought-timeline {
  position: relative;
  display: grid;
  gap: 1.25rem;
  margin-top: 2rem;
  padding-left: 1.5rem;
}

.thought-timeline::before {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  left: 0.35rem;
  width: 2px;
  content: "";
  background: var(--vp-c-divider);
}

.thought-card {
  position: relative;
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.thought-card::before {
  position: absolute;
  top: 1.55rem;
  left: -1.55rem;
  width: 0.7rem;
  height: 0.7rem;
  content: "";
  border: 2px solid var(--vp-c-brand-1);
  border-radius: 50%;
  background: var(--vp-c-bg);
}

.thought-card time {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.thought-card h2 {
  margin: 0.35rem 0 0.75rem;
  border: 0;
}

.thought-summary :deep(p) {
  margin: 0;
}

.thought-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin-top: 1rem;
  font-size: 0.85rem;
}

.thought-tag {
  color: var(--vp-c-brand-1);
}

.thought-meta a {
  margin-left: auto;
}

.thought-empty {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-2);
}
</style>
