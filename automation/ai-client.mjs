export function loadAiProviders() {
  return [
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
}

export async function generateJsonWithFallback({
  developerPrompt,
  userInput,
  providers = loadAiProviders()
}) {
  if (!providers.length) throw new Error("没有可用的 AI 线路");
  const errors = [];
  for (const provider of providers) {
    try {
      const result = await requestResponses(
        developerPrompt,
        userInput,
        provider
      );
      console.log(`ai_provider=${provider.name} ai_model=${provider.model}`);
      return result;
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
      console.warn(`AI 线路 ${provider.name} 失败，尝试下一线路：${error.message}`);
    }
  }
  throw new Error(`所有 AI 线路均失败：${errors.join(" | ")}`);
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

async function requestResponses(developerPrompt, userInput, provider) {
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
          content: [{ type: "input_text", text: developerPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userInput }]
        }
      ]
    })
  });
  const result = await readResponseJson(response);
  if (!response.ok) {
    if (shouldTryChatCompletions(response.status, result)) {
      return requestChatCompletions(
        developerPrompt,
        userInput,
        provider
      );
    }
    throw new Error(formatApiError(response.status, result));
  }
  const outputText = result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("Responses API 返回中没有 output_text");
  return parseJson(outputText);
}

async function requestChatCompletions(
  developerPrompt,
  userInput,
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
        { role: "user", content: userInput }
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
  return parseJson(outputText);
}

function parseJson(outputText) {
  return JSON.parse(
    outputText.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  );
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
