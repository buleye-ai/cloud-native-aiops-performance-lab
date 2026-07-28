import { getArg } from "./lib.mjs";
import {
  escapeHtml,
  readJson,
  shanghaiDateParts,
  telegramApi,
  writeJson
} from "./telegram-sync-lib.mjs";
import {
  generateJsonWithFallback,
  loadAiProviders
} from "./ai-client.mjs";

const slot = getArg("--slot");
if (!["morning", "evening"].includes(slot)) {
  throw new Error("--slot 必须是 morning 或 evening");
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID;
if (!adminUserId) throw new Error("缺少 TELEGRAM_ADMIN_USER_ID");

const statePath = "publication/english-reading-state.json";
const state = await readJson(statePath, {
  started_at: shanghaiDateParts(new Date()).date,
  next_lesson: 1,
  deliveries: {}
});
const date = shanghaiDateParts(new Date()).date;
const deliveryKey = `${date}:${slot}`;

if (state.deliveries[deliveryKey]) {
  console.log(`delivery=${deliveryKey} already_sent=true`);
  process.exit(0);
}

const lesson = Number(state.next_lesson || 1);
const plan = learningPlan(lesson);
const topic = selectTopic(slot, lesson);
const content = await generateJsonWithFallback({
  providers: loadAiProviders(),
  developerPrompt: buildPrompt(plan),
  userInput: JSON.stringify({
    lesson,
    time_of_day: slot,
    topic,
    learner: {
      native_language: "Chinese",
      vocabulary_size: "about 2,000 words",
      current_level: "A2"
    }
  })
});

validateContent(content);
const message = await telegramApi(
  "sendMessage",
  {
    chat_id: adminUserId,
    text: renderReading(content, { lesson, slot, plan }),
    parse_mode: "HTML",
    disable_web_page_preview: true
  },
  telegramToken
);

state.deliveries[deliveryKey] = {
  lesson,
  level: plan.level,
  topic: content.topic,
  telegram_message_id: message.message_id,
  sent_at: new Date().toISOString()
};
state.next_lesson = lesson + 1;
state.deliveries = Object.fromEntries(
  Object.entries(state.deliveries).slice(-180)
);
await writeJson(statePath, state);

console.log(
  `delivery=${deliveryKey} lesson=${lesson} level=${plan.level} message_id=${message.message_id}`
);

function learningPlan(number) {
  if (number <= 56) {
    return {
      level: "A2",
      words: "120-150",
      sentenceStyle: "mostly 8-14 words; use simple present, past and future"
    };
  }
  if (number <= 112) {
    return {
      level: "A2+",
      words: "150-180",
      sentenceStyle: "mostly 10-16 words; add because, although, when and if"
    };
  }
  return {
    level: "B1",
    words: "180-220",
    sentenceStyle: "varied but clear sentences; introduce one idea with nuance"
  };
}

function selectTopic(timeOfDay, number) {
  const topics = {
    morning: [
      "a calm morning routine",
      "taking a bus or train to work",
      "planning three important tasks",
      "making a simple healthy breakfast",
      "talking about the weather",
      "asking a coworker for help",
      "staying focused in a busy office",
      "a short walk before work",
      "buying useful things at a shop",
      "keeping a small home tidy",
      "making plans with family",
      "having a good lunch break"
    ],
    evening: [
      "cooking an easy dinner",
      "a small lesson from travel",
      "why sleep helps the brain",
      "how people make friends",
      "a surprising fact about nature",
      "enjoying music as a hobby",
      "saving a little money each week",
      "life in a different kind of city",
      "a simple idea from science",
      "how food connects people",
      "learning from a small mistake",
      "choosing a good weekend activity"
    ]
  };
  const offset = timeOfDay === "morning" ? 0 : 5;
  const list = topics[timeOfDay];
  return list[(number + offset - 1) % list.length];
}

function buildPrompt(plan) {
  return `You are a careful English reading teacher for a Chinese adult learner.
Create one useful, natural short reading at CEFR ${plan.level}.
The passage must be ${plan.words} English words and use high-frequency language.
Sentence guidance: ${plan.sentenceStyle}.
The learner knows about 2,000 words. Avoid obscure names, rare idioms, slang, politics,
disturbing events, and specialist knowledge. Make the situation practical and memorable.
At most three vocabulary items may be genuinely new; the others should be useful phrases
or review. Do not provide a full Chinese translation.

Return only valid JSON with exactly this structure:
{
  "title": "short English title",
  "level": "${plan.level}",
  "topic": "short English topic",
  "passage": "the English passage",
  "vocabulary": [
    {"term": "word or phrase", "meaning": "concise Chinese meaning", "example": "simple English example"}
  ],
  "questions": [
    {"question": "English comprehension question", "answer": "short English answer"}
  ],
  "useful_sentence": "one reusable English sentence pattern",
  "chinese_hint": "one short Chinese reading tip, not a translation"
}
Vocabulary must contain exactly 5 items. Questions must contain exactly 3 items.
All facts must be safe, timeless, and accurate.`;
}

function validateContent(value) {
  const required = [
    "title",
    "level",
    "topic",
    "passage",
    "useful_sentence",
    "chinese_hint"
  ];
  for (const field of required) {
    if (!value?.[field] || typeof value[field] !== "string") {
      throw new Error(`AI 返回缺少字段：${field}`);
    }
  }
  if (!Array.isArray(value.vocabulary) || value.vocabulary.length !== 5) {
    throw new Error("AI 返回的 vocabulary 必须恰好有 5 项");
  }
  if (!Array.isArray(value.questions) || value.questions.length !== 3) {
    throw new Error("AI 返回的 questions 必须恰好有 3 项");
  }
}

function renderReading(content, context) {
  const period = context.slot === "morning" ? "Morning" : "Evening";
  const words = content.vocabulary
    .map(
      (item, index) =>
        `${index + 1}. <b>${escapeHtml(item.term)}</b> — ${escapeHtml(item.meaning)}\n` +
        `   <i>${escapeHtml(item.example)}</i>`
    )
    .join("\n");
  const questions = content.questions
    .map((item, index) => `${index + 1}. ${escapeHtml(item.question)}`)
    .join("\n");
  const answers = content.questions
    .map((item, index) => `${index + 1}. ${escapeHtml(item.answer)}`)
    .join("\n");

  return [
    `📖 <b>${period} Reading · Lesson ${context.lesson} · ${escapeHtml(context.plan.level)}</b>`,
    "",
    `<b>${escapeHtml(content.title)}</b>`,
    `<i>${escapeHtml(content.topic)}</i>`,
    "",
    escapeHtml(content.passage),
    "",
    "<b>Words &amp; phrases</b>",
    words,
    "",
    "<b>Check your understanding</b>",
    questions,
    "",
    "<b>Answers</b>",
    `<tg-spoiler>${answers}</tg-spoiler>`,
    "",
    "<b>Useful sentence</b>",
    escapeHtml(content.useful_sentence),
    "",
    `💡 ${escapeHtml(content.chinese_hint)}`
  ].join("\n");
}
