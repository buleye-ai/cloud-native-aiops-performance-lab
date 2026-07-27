<script setup lang="ts">
import { data as cards } from "../../learning.data.mts";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
</script>

<template>
  <div v-if="cards.length" class="learning-grid">
    <article v-for="card in cards" :key="card.url" class="learning-card">
      <time :datetime="card.date">{{ formatDate(card.date) }}</time>
      <h2><a :href="card.url">{{ card.title }}</a></h2>
      <div class="learning-summary" v-html="card.summary" />
      <div class="learning-tags">
        <span v-for="tag in card.tags" :key="tag">#{{ tag }}</span>
      </div>
    </article>
  </div>
  <div v-else class="learning-empty">
    暂无已收录内容。Telegram 私聊中的候选卡片只有在点击“收录博客”后，
    才会出现在这里。
  </div>
</template>

<style scoped>
.learning-grid {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
}

.learning-card {
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.learning-card time {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.learning-card h2 {
  margin: 0.35rem 0 0.75rem;
  border: 0;
}

.learning-summary :deep(p) {
  margin: 0;
}

.learning-tags {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
  color: var(--vp-c-brand-1);
  font-size: 0.85rem;
}

.learning-empty {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-2);
}
</style>
