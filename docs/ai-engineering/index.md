---
title: 从会聊天到会交付：AI Agent 工程的演进、工具地图与实践路线
description: 从问题驱动的视角理解 LLM、Agent、MCP、Skills、Harness 与主流 AI 产品，并完成可验证的实践路线
telegram_publish: true
telegram_version: 1
---

# 从会聊天到会交付：AI Agent 工程的演进、工具地图与实践路线

> 更新于 2026-08-02。AI 工具变化很快，本文优先解释稳定的工程问题；产品能力以链接的官方文档为准。

如果想进一步比较 ChatGPT、Claude、Claude Code、Gemini、Kimi、Grok 等具体产品，请阅读：[主流 AI 能力、优缺点与选型指南](/ai-engineering/mainstream-ai-guide)。

过去几年最重要的变化，不只是模型越来越聪明，而是我们逐渐补齐了模型与真实世界之间缺失的工程层：知识、工具、权限、循环、记忆、规范、验证和运行环境。

这条演进主线可以浓缩为一句话：

> **LLM 负责判断下一步，工具负责改变世界，Loop 负责持续推进，Harness 负责让整个过程安全、可控、可观测。**

## 先看全景：新名词为什么不断出现

![AI Agent 工程演进路线](/ai-engineering/ai-evolution.svg)

这些词并不是彼此替代，而是分布在不同层：

| 层次 | 代表名称 | 它主要解决的问题 |
|---|---|---|
| 模型运行层 | 云端模型、Ollama | 在哪里、以什么成本和隐私边界运行模型 |
| 连接协议层 | MCP | Agent 如何用统一方式发现和调用数据、工具 |
| 能力知识层 | Skill / Agent Skills | 如何复用领域操作步骤、脚本和注意事项 |
| 决策执行层 | Agent、Loop | 如何在观察—思考—行动—反馈中完成多步目标 |
| 控制运行层 | Harness | 如何提供上下文、权限、沙箱、状态、重试、追踪和评测 |
| 产品宿主层 | Codex、Claude Code、Pi、Hermes Agent | 把上述能力组合成可直接工作的 Agent 产品 |
| 配置辅助层 | CC Switch | 如何管理多个 Coding Agent 的模型供应商和配置 |

## AI 全局地图：把所有流行名词放回正确位置

如果只看新闻和社交媒体，AI 像是每天都在出现一个必须马上学习的新世界。但从工程视角看，绝大多数新名词都能放回下面九层。**先判断它在哪一层，再问它解决什么问题，陌生感就会迅速下降。**

[![2026 AI 全局分层地图，点击查看原图](/ai-engineering/ai-landscape.svg)](/ai-engineering/ai-landscape.svg)

> 点击图片可以单独打开原图。在手机上建议横屏查看。

### 一句话认识每一层

| 层 | 你真正要理解的事 | 热门名称只是例子 |
|---|---|---|
| 算力与训练 | 模型必须在计算、存储和网络上训练、运行 | GPU、CUDA、PyTorch、LoRA、Kubernetes、Ray |
| 模型 | 负责理解、推理和生成，决定能力上限 | GPT、Claude、Gemini、Llama、Qwen、DeepSeek |
| 推理服务 | 把模型包装成稳定 API，并优化吞吐、延迟和成本 | OpenAI API、Anthropic API、Ollama、vLLM、llama.cpp |
| 知识与上下文 | 把模型参数里没有的信息在运行时交给它 | Prompt、RAG、Embedding、Vector DB、Memory |
| 能力与协议 | 统一工具、Agent 和工作方法的接入方式 | MCP、A2A、Skills、Function Calling、AGENTS.md |
| Agent 核心 | 让模型在 Loop 中观察、决策、行动和验证 | Tool Use、ReAct、Planning、Multi-Agent |
| Harness | 给 Agent 加上状态、权限、沙箱、重试和停止条件 | Agents SDK、Claude Agent SDK、LangGraph、CrewAI、AutoGen |
| 产品与入口 | 把下面各层组合成用户可以直接使用的产品 | ChatGPT、Claude、Codex、Claude Code、Cursor、Pi、Hermes |
| 横切治理 | 判断系统是否可靠、安全、经济并能持续改进 | Evals、Tracing、Guardrails、LLMOps、Human-in-the-loop |

### 你提到的名称，究竟在地图哪里

| 名称 | 所在位置 | 不是什么 | 记忆方法 |
|---|---|---|---|
| Agent | 决策执行层 | 不是某个具体模型 | 一个使用模型和工具推进目标的系统 |
| Loop | Agent 核心控制流 | 不是独立产品 | Agent 的“观察—行动—验证”循环 |
| Harness | Agent 运行控制层 | 不等于 Agent，也不只是框架 | Agent 的操作系统与安全笼子 |
| MCP | 能力协议层 | 不负责思考和规划 | Agent 连接工具的 USB-C |
| Skill | 可复用方法层 | 不等于工具 API | 教 Agent 怎样把某类工作做好 |
| Codex | Coding Agent 产品 | 不只是代码模型 | OpenAI 组合好的软件工程 Agent |
| Claude Code | Coding Agent 产品 | 不只是 Claude 聊天入口 | Anthropic 在终端里的软件工程 Agent |
| Pi | 轻量 Coding Agent / Harness | 不是 Raspberry Pi | 小核心、容易扩展和实验 |
| Hermes Agent | 长期运行的通用 Agent 产品 | 不等于 Hermes 模型 | 自托管、记忆、消息入口与持续任务 |
| Ollama | 本地推理服务层 | 不是一个模型 | 在电脑上下载、管理并运行模型 |
| CC Switch | 配置辅助层 | 不是 Agent、模型或协议 | 帮多个 Agent CLI 切换供应商和配置 |
| RAG | 知识与上下文层 | 不是重新训练模型 | 先检索资料，再让模型基于资料回答 |
| Embedding | 知识检索基础能力 | 不是生成式聊天模型 | 把语义变成可比较的向量 |
| Vector DB | 上下文存储选择 | 不是 RAG 的全部 | 保存和检索向量，普通数据库也可能胜任 |
| A2A | Agent 间协议层 | 不替代 MCP | MCP 连工具，A2A 连独立 Agent |
| LangGraph | Harness / 编排框架 | 不是模型 | 构建有状态、可恢复的 Agent 工作流 |
| vLLM | 生产推理服务层 | 不是模型 | 在服务器和 GPU 上高吞吐运行模型 |
| Evals | 横切质量层 | 不只是让另一个模型打分 | 用固定任务和标准证明系统是否变好 |
| LLMOps | 横切生产治理 | 不是一个具体软件 | AI 系统的发布、观测、评测、成本和治理实践 |

### 面对一个新 AI 名词，只问四个问题

以后再看到新名词，不需要立即安装，也不用先研究全部功能。只问：

1. **它在哪一层？** 模型、推理、上下文、协议、Agent、Harness、产品，还是治理？
2. **它替谁解决了什么痛点？** 是开发者的接入问题、用户的任务问题，还是平台团队的生产问题？
3. **它的输入和输出是什么？** 输入 Prompt、文档、工具描述还是任务；输出 Token、工具调用、状态还是最终交付物？
4. **不用它会怎样？** 如果当前没有这个痛点，就先认识，不必学习和安装。

例如看到一个新的 Agent 框架：它大概率仍然是在管理 **模型 + Context + Tool + Loop + State**。你真正需要比较的是状态持久化、权限、恢复、可观测性和评测，而不是被新的产品名重新吓一次。

### 你的学习重点不是整个地图

结合你的云原生与运维开发经验，最有价值的主线只有一条：

```text
Kubernetes / Linux / Observability
                ↓
       Tool + MCP + Skill
                ↓
      Agent Loop + Harness
                ↓
 Evals + Tracing + 安全与成本治理
                ↓
  可验证的 Incident Agent / AI Platform
```

你不需要成为模型训练科学家，也不需要熟练使用每个 Coding Agent。你已有的 Linux、Kubernetes、网络、可观测性、自动化和生产事故经验，恰好是当前 Agent 系统最缺的工程地基。需要补的是把这些经验连接到 **MCP、Skills、Harness、Evals 和 Agent Observability**，而不是从零开始追完整个 AI 行业。

可以把学习分成三圈：

- **必须掌握**：模型边界、Context、Tool Use、Agent Loop、权限、Evals、Tracing。
- **按项目实践**：MCP、Skill、RAG、Ollama、LangGraph 或 Agents SDK。
- **知道位置即可**：每天出现的新模型、新 Agent 产品、新向量数据库和排行榜。

真正的自信不是知道所有名词，而是遇到任何新名词时，都能把它放回地图、解释其输入输出，并判断自己现在是否需要它。

## 从历史看现状：为什么这些名字会突然出现

AI 的发展不是某一天突然从聊天机器人跳成了 Agent。更真实的过程是：模型先获得语言能力，然后逐步接上知识、工具、循环、运行环境和安全控制。媒体通常只报道最上层的新产品，于是底层连续演进看起来像一连串突发事件。

[![2017 到 2026 AI 工程演进史，点击查看原图](/ai-engineering/ai-history.svg)](/ai-engineering/ai-history.svg)

### 2017—2020：先造出更强的“大脑”

Transformer 奠定现代大语言模型的主要架构基础。随后预训练模型证明：先从海量数据学习通用语言规律，再通过提示或微调完成具体任务是可行的。这个阶段的中心问题是**模型能否理解和生成**。

### 2021—2022：模型进入普通人的工作界面

GitHub Copilot 将生成能力带进 IDE，但主要还是补全和建议；ChatGPT 则把自然语言变成大众入口。这个阶段解决的是**普通人怎样方便地使用模型**，还没有真正解决模型如何独立完成长任务。

### 2023：给模型接上知识、工具和循环

RAG 让模型可以临时读取参数外的资料；Function Calling 让程序能够把模型输出转换为 API 调用；ReAct、AutoGPT 等实践让“思考—行动—观察”循环进入大众视野。Agent 的基本结构至此已经形成，但可靠性、成本和无限循环问题也随之暴露。

### 2024：Agent 开始进入完整工作环境

Devin、OpenHands 等软件工程 Agent 让模型操作代码仓库、Shell 和浏览器；MCP 开始统一 Agent 与工具、数据之间的连接。焦点从“模型能不能写代码”转向**系统能不能把一项任务推进到完成**。

### 2025：Coding Agent 从助手走向工程执行者

Codex、Claude Code 等产品把读仓库、跨文件修改、执行测试、Git 工作流和远程任务组合起来。A2A、AGENTS.md 等规范试图解决 Agent 间通信和仓库级指令复用。此时竞争的已不只是模型能力，更是 Harness、上下文工程和验证闭环。

### 2026：长期 Agent、Skills 和 Agent 基础设施

Hermes Agent、OpenClaw 一类产品强调长期在线、持久记忆、消息入口、定时任务和 Skills；Pi 则把轻量、透明、可扩展的 Agent Harness 直接暴露给开发者。它们不是突然出现的新物种，而是把过去几年的模型、Tool Use、Memory、Loop、Skills 和 Harness 重新组合成不同产品。

## 2026 AI 周边产品地图

同一个名称有时会横跨多个分类。例如 Goose 既能做编码，也能执行通用工作流；Cursor 既是编辑器，也是 Coding Agent 宿主。不要追求唯一正确的标签，只需先找到它的**主要岗位**。

[![AI 产品生态分类地图，点击查看原图](/ai-engineering/ai-products.svg)](/ai-engineering/ai-products.svg)

### 产品群一：模型——提供能力的大脑

GPT、Claude、Gemini、Llama、Qwen、DeepSeek、Mistral 属于这一层。它们的主要产物是 Token、Embedding 或多模态输出。媒体所说的“发布了新模型”，通常真的发生在这一层。

判断方法：它是否经过训练、有参数规模和权重/API，并被其他应用调用？如果是，它大概率是模型。

### 产品群二：聊天、搜索与知识产品——面向人的窗口

ChatGPT、Claude、Gemini、Perplexity、NotebookLM 把模型与搜索、文件、UI、账号和应用能力组合起来。产品名称有时与模型名称相同，例如 Claude 既指模型家族，也常指聊天产品，必须结合语境判断。

### 产品群三：Coding Agent——进入软件工程环境的执行者

- **终端型**：Codex CLI、Claude Code、Pi、Aider、OpenCode、Goose。
- **IDE / 编辑器型**：Cursor、GitHub Copilot、Windsurf、Cline、Roo Code、Continue。
- **平台 / 云任务型**：Codex Cloud、Devin、OpenHands。

它们的共同点不是使用同一个模型，而是拥有仓库上下文、文件编辑、Shell、测试和 Git 等工具。模型可以更换，真正形成产品差异的是上下文管理、权限、执行环境、验证、交互与恢复能力。

### 产品群四：个人与通用 Agent——长期在线的数字助理

Hermes Agent、OpenClaw、Manus 等更强调跨领域任务，而不是只围绕代码仓库。典型能力包括持久记忆、浏览器、消息渠道、定时任务、Skills 和子 Agent。

这类产品更像一个拥有账号和工具的长期进程，因此风险也高于普通聊天：它记得更多、运行更久、接触的凭据更多。理解产品时应同时问“它能做什么”和“它拿到了什么权限”。

### 产品群五：Agent 框架和工作流平台——给开发者的装配工厂

LangGraph、OpenAI Agents SDK、Claude Agent SDK、CrewAI、AutoGen 面向代码开发；n8n、Dify、Flowise、Coze 更偏可视化或低代码工作流。它们不是终端用户的“新 AI”，而是用来构建 AI 产品的工具。

### 产品群六：本地运行、推理服务和网关——模型发动机房

- Ollama、LM Studio、llama.cpp：降低个人设备运行开放权重模型的门槛。
- vLLM：偏向服务器和 GPU 上的高吞吐推理服务。
- LiteLLM、OpenRouter：帮助应用用较统一的方式访问多个模型供应商。
- Open WebUI：为不同模型后端提供聊天式 Web 界面。

它们解决部署、访问和体验问题，本身不等于模型能力。

### 产品群七：协议、规范与能力包——生态的插座和手册

MCP 连接 Agent 与工具；A2A 连接独立 Agent；Agent Skills 封装操作方法；AGENTS.md 为 Coding Agent 提供仓库级说明；ACP 等协议服务于 Agent 与客户端/编辑器之间的互操作。它们的价值是减少生态中的重复集成。

### 产品群八：观测、评测与治理——AI 系统的质检体系

Langfuse、LangSmith、Phoenix、OpenTelemetry、Evals、Guardrails 和 LLMOps 回答另一类问题：Agent 走了哪条路径、调用了什么工具、花了多少钱、结果是否正确、升级模型后是否退化、出现事故能否追踪。

这部分与既有云原生观测、SRE 和平台工程的联系最紧密，也是你的经验最容易形成优势的区域。

## Hermes 与 Pi：两个“它不是新模型”的完整例子

### Hermes Agent 到底是什么

Hermes Agent 是 Nous Research 在 2026 年发布的开源 Agent 产品。它组合了：

- 可以替换的模型后端；
- 工具调用和 Agent Loop；
- 跨会话持久记忆；
- 可复用及可积累的 Skills；
- Telegram、Discord、Slack 等消息入口；
- 在个人电脑或服务器长期运行的能力。

因此看到“Hermes 发布”，先确认语境：

- **Hermes 模型**：Nous Research 的模型系列，属于“模型层”。
- **Hermes Agent**：调用模型、记忆和工具完成任务的产品，属于“Agent 产品 + Harness 层”。

它带来的新鲜感主要是把长期记忆、技能积累和自托管通用 Agent 做成完整产品，而不是发明了 Agent 的基本循环。

### Pi 到底是什么

Pi 当前官方定位是 **Pi Agent Harness**，项目中主要包含：

- `pi-ai`：统一多个模型供应商 API；
- `pi-agent-core`：带工具调用和状态管理的 Agent Runtime；
- `pi-coding-agent`：交互式 Coding Agent CLI；
- `pi-tui`：终端 UI 组件。

所以 Pi 可以同时被叫作 Coding Agent、Agent Toolkit 或 Harness，取决于讨论的是它的哪个部分。它强调小核心和扩展能力，适合想观察、修改或重新组合 Agent 机制的人。

还有一个重要的生产事实：Pi 官方说明默认以启动用户的权限运行，没有内建文件系统、进程、网络和凭据权限隔离。使用它并不等于自动获得安全边界；真正用于敏感环境时需要容器、微型虚拟机或策略沙箱。

### 把 Hermes、Pi 和其他产品放在一起比较

| 名称 | 主要定位 | 默认工作范围 | 最突出的取舍 |
|---|---|---|---|
| Codex | Coding Agent 产品 | 代码仓库和软件任务 | 完整工程执行与验证 |
| Claude Code | Coding Agent 产品 | 终端、仓库和工具链 | 深度终端工作流与扩展生态 |
| Pi | 轻量 Agent Harness + Coding CLI | 本地开发环境 | 透明、可扩展；隔离需自行设计 |
| Goose | 本机通用 Agent | 编码和通用工作流 | 开源、多模型、可扩展 |
| OpenHands | 软件 Agent 平台 | 本地、远程和云端开发任务 | 自托管与规模化 Agent 任务 |
| Hermes Agent | 长期通用 Agent | 个人基础设施和消息渠道 | 持久记忆、Skills、长期运行 |
| OpenClaw | 个人 AI 助理平台 | 多系统、多渠道和自动任务 | 广泛连接能力，同时扩大权限风险 |
| Ollama | 本地模型运行服务 | 模型下载、运行和 API | 不是 Agent，但可为上述 Agent 提供模型 |
| CC Switch | 配置辅助工具 | 多个 Agent CLI 的供应商配置 | 不产生智能，只降低配置切换成本 |

## 给外行人的三十秒版本

如果需要向完全不了解 AI 的人解释，可以这样说：

> GPT、Claude、Gemini 像不同品牌的大脑；ChatGPT 和 Claude App 是让人和大脑聊天的窗口；Ollama、vLLM 是运行大脑的发动机；RAG 和 Memory 给它补资料；MCP 给它连接工具；Skill 教它工作方法；Loop 让它持续做事；Harness 管住权限、状态和错误；Codex、Claude Code、Pi、Hermes 则是把这些零件装成不同岗位的 AI 员工。名字每天都在变，但零件和工程问题没有每天重来。

再看到一个突然流行的名称，可以先说：

> “先别告诉我它有多火。告诉我它使用哪个模型、拥有什么工具、有没有记忆、运行在哪、权限多大、如何验证完成。”

能回答这六个问题，你就已经从新闻围观者变成了系统理解者。

## 一、从 LLM 到 Augmented LLM：模型为什么需要“外接系统”

最初的聊天式 LLM 很像一个博闻强记、但被关在房间里的人：它能根据训练数据生成答案，却不知道你公司昨天的事故、不能读取当前仓库，也不能真的执行 `kubectl` 或提交代码。

因此先后出现了三类增强：

1. **Context / RAG**：在请求时把文档、代码和检索结果放进上下文，解决“知识不在模型参数里”。
2. **Memory**：保存会话、偏好和任务状态，解决“跨轮次或跨会话遗忘”。
3. **Tool Use**：让模型返回结构化的工具调用，由程序执行后再把结果交还模型，解决“只能说、不能做”。

模型本身仍是概率性的文本/结构化输出生成器。真正读取文件、访问 API、执行命令的是外部程序。理解这条安全边界非常关键：**不是模型拥有权限，而是宿主程序代模型使用了权限。**

## 二、MCP：工具越来越多后，为什么需要统一插座

工具调用刚出现时，每个 AI 应用都要为 GitHub、数据库、文件系统、监控平台分别写一套私有适配器。假设有 5 个 Agent 和 10 个工具，最坏会形成 50 组集成关系。

[Model Context Protocol（MCP）](https://modelcontextprotocol.io/docs/learn/architecture) 将这件事标准化。它采用 Host—Client—Server 架构，并用 JSON-RPC 交换消息：

![MCP Host、Client、Server 架构](/ai-engineering/mcp-architecture.svg)

MCP Server 可以暴露三类核心能力：

- **Tools**：有副作用或需要计算的动作，例如创建 Issue、查询指标。
- **Resources**：可读取的上下文，例如文件、Schema、运行手册。
- **Prompts**：可复用的提示模板。

MCP 解决的是**连接和能力发现**，不负责 Agent 如何规划、是否允许调用、调用后怎样验证。换句话说，MCP 是 USB-C，不是电脑操作系统。

生产上应特别注意：工具描述注入、过宽权限、凭据泄露、Server 供应链以及把外部文本误当系统指令。最小权限、人工审批、输入输出校验和审计日志都属于 Harness 的职责。

## 三、Agent 与 Loop：从单次回答到多步闭环

当模型能够使用工具后，一个最小 Agent 就出现了：它观察当前状态，决定下一步，执行工具，读取结果，再决定是否继续。

![Agent 观察、规划、行动与验证闭环](/ai-engineering/agent-loop.svg)

这里的 **Loop** 不是某个单一产品，而是 Agent 的基本控制结构。OpenAI Agents SDK 的 Runner 也明确描述为：Agent 在循环中运行，直到生成最终输出。一个可靠 Loop 至少要有：

- 明确目标和可验证的完成条件；
- 最大轮次、时间和费用预算；
- 每轮都从环境获取新证据，而不是反复自言自语；
- 对重复失败、无进展和危险动作的停止条件；
- 必要时让人批准、纠偏或接管。

没有停止条件的 Loop 会变成无限工具调用；没有外部证据的 Loop 只是更昂贵的幻觉。

## 四、Harness：为什么“模型 + while 循环”还不够

**Agent Harness（Agent 运行与控制框架）** 是把模型包起来的工程系统。它不是模型，也不等于 Agent；它决定 Agent 看见什么、能做什么、怎样继续，以及出了问题如何恢复。

![Agent Harness 分层架构](/ai-engineering/agent-harness.svg)

一个生产级 Harness 通常包含：模型路由、系统指令、上下文压缩、工具注册、权限策略、沙箱、状态持久化、重试与幂等、人工介入、Tracing、成本限制和 Evals。Codex、Claude Code、Pi、Hermes 都可以视为不同取舍的 Harness + Agent 产品。

## 五、Skill：为什么有了 MCP 还需要技能

MCP 告诉 Agent **“有什么工具、怎样调用”**；Skill 告诉 Agent **“面对某类任务应该按什么方法做”**。

例如 Prometheus MCP Server 能提供 `query_range`，但它不会天然告诉 Agent：CPU throttling 事故应该先核对限额，再对齐 throttled seconds 与请求延迟，最后检查调度和工作负载变更。这个稳定的领域流程适合写成 Skill。

[Agent Skills 规范](https://agentskills.io/specification) 将技能组织成可发现、可复用的目录，核心通常是 `SKILL.md`，并可附带脚本、模板和参考资料：

```text
k8s-incident-skill/
├── SKILL.md              # 何时使用、步骤、边界与验收标准
├── scripts/              # 确定性的采集或校验脚本
├── references/           # Runbook、指标语义、故障模式
└── assets/               # 报告模板或示例
```

Skill 解决重复教学和流程漂移，但它也可能携带恶意指令或脚本。安装社区 Skill 前应像审查代码依赖一样检查来源、内容、权限和更新。

## 六、热门产品各自在解决什么

### Codex：把软件任务交给可验证的 Coding Agent

[OpenAI Codex](https://openai.com/codex/) 的重点不是补全下一行，而是读取仓库、编辑多文件、执行命令和测试，并将一个软件工程任务推进到可审查的结果。Codex CLI 在本地运行，云端形态则适合隔离任务与并行处理。

它解决的是：**聊天模型给出代码建议后，工程师仍需手动定位、修改、执行和验证的断层。** Harness 提供仓库上下文、沙箱/审批、工具执行、任务状态与验证反馈。

### Claude Code：终端中的 Agentic Coding 工作流

[Claude Code](https://github.com/anthropics/claude-code) 同样面向真实仓库，能理解代码、修改文件、运行命令并处理 Git 工作流。它强化了终端中的长任务协作、项目指令、子 Agent、Hooks、MCP 与 Skills 等扩展方式。

它解决的是：**把“问 Claude 怎么写”变成“让 Claude 在现有工具链里完成并验证”。** 与 Codex 的产品体验和模型取舍会变化，但二者本质都属于 Coding Agent Harness，而不是一种新的基础模型类别。

### Pi：小核心、强扩展的 Coding Agent

[Pi Agent Harness](https://github.com/earendil-works/pi) 强调轻量核心和可扩展性。它适合希望自己组合模型、工具、扩展、会话和 UI，而不是接受庞大固定工作流的开发者。

它解决的是：**通用 Coding Agent 功能越来越多、默认行为越来越重，实验者却需要一个透明、可改造的最小 Harness。** Pi 不应与数学常数或 Raspberry Pi 混淆。

### Hermes Agent：可自托管、可持续记忆的通用 Agent

[Nous Research Hermes Agent](https://github.com/NousResearch/hermes-agent) 更接近长期运行的个人/通用 Agent，而非只服务代码仓库。它强调运行在自己的基础设施上、持久记忆、Skills、工具和消息渠道。

它解决的是：**一次性聊天和单会话 Agent 无法长期积累用户上下文，也难以从多个入口持续执行任务。** 相应地，长期在线、广泛权限和持久记忆会扩大攻击面，部署时必须隔离凭据、限制工具权限并审计外部输入。

> 注意：Hermes 也指 Nous Research 的模型系列。本文的 “Hermes” 专指 **Hermes Agent**，两者不是同一个层次。

### Ollama：降低本地模型运行门槛

[Ollama](https://docs.ollama.com/quickstart) 将本地模型的下载、版本、启动和 API 服务封装成相对统一的体验，并能作为部分 Coding Agent 的模型后端。

它解决的是：**开放权重模型虽可下载，但量化文件、运行时、模型管理与 API 接入仍然繁琐。** 本地运行可改善隐私、离线性和边际调用成本，但受内存、显存、上下文长度、推理速度和模型能力限制；“数据在本地”也不自动等于“系统安全”。

### CC Switch：多 Coding Agent、多供应商配置管理

[CC Switch](https://github.com/farion1231/cc-switch) 是第三方开源桌面工具，用于管理和切换 Claude Code、Codex、Gemini CLI、OpenCode、Hermes 等应用的供应商与相关配置。

它解决的是：**多个 Agent CLI、多个 API 供应商和配置文件带来的重复修改与切换成本。** 它不是模型、Agent 或协议，也不是 Codex/Claude Code 官方组件。由于它可能接触 API 配置和本地代理流量，只应从官方仓库下载，并审查凭据保存、代理和更新机制。

## 七、容易混淆的关系

| 常见误解 | 更准确的说法 |
|---|---|
| Agent 是一种更强的模型 | Agent 是模型、工具、状态与 Loop 组成的系统 |
| MCP 会让模型变聪明 | MCP 让工具接入标准化，不提升模型推理上限 |
| Skill 就是 Tool | Tool 是动作接口；Skill 是完成任务的操作知识 |
| Harness 就是框架库 | Harness 是完整运行控制层，库只是实现方式之一 |
| Ollama 是一个模型 | Ollama 是模型运行和管理工具，模型是 Qwen、Llama 等 |
| Codex / Claude Code / Pi 必须三选一 | 它们是不同取舍的宿主，可按任务、成本与治理边界选择 |
| 多 Agent 一定优于单 Agent | 只有角色可分解、上下文需隔离或可并行验证时才值得增加复杂度 |

## 八、可实践流程：做一个“可验证的 Kubernetes 事故 Agent”

目标不是安装一堆热门工具，而是构建一条能展示云原生 + Agent 工程能力的证据链：

> 输入一份脱敏的 Pod 故障材料 → Agent 按 Skill 调查 → 通过受限工具读取证据 → 输出带依据的诊断报告 → 用测试和人工清单验收。

### 最终目录

```text
k8s-incident-agent/
├── AGENTS.md                  # 项目边界、命令和完成条件
├── skills/k8s-diagnosis/
│   ├── SKILL.md              # 诊断流程与停止条件
│   └── references/
│       └── crashloop.md       # 故障模式
├── fixtures/
│   ├── pod.json               # 脱敏 kubectl 输出
│   └── events.txt
├── tools/
│   └── evidence_server.py     # 只读 MCP Server（第二阶段再做）
├── reports/
│   └── diagnosis.md
├── evals/
│   ├── expected.yaml
│   └── evaluate.py
└── run.sh                     # 有预算和停止条件的 Loop
```

### 阶段 0：先定义成功，而不是先选模型

写出机器可检查的完成条件：

- 报告必须区分“事实、推断、未知”；
- 每个结论必须引用 `fixtures/` 中的证据路径和字段；
- 不允许访问真实集群，也不允许执行写操作；
- 至少列出一个被排除的假设及依据；
- 无证据时输出“无法确定”，禁止补造；
- 最多 8 轮，超限后停止并报告阻塞点。

这一步定义了 Eval，也定义了 Agent 何时应该停止。

### 阶段 1：用一个 Coding Agent 跑通最小闭环

选择 Codex、Claude Code 或 Pi 中任意一个，不要同时引入三个。先只给它本地文件读取和报告写入权限：

1. 在 `AGENTS.md` 写清仓库结构、允许命令、禁止事项和验收命令。
2. 放入脱敏的 `pod.json`、events 和应用日志。
3. 让 Agent 预测根因，并要求它在修改前列出准备读取的证据。
4. 让 Agent 生成 `reports/diagnosis.md`。
5. 运行确定性检查，确认引用存在、章节齐全、没有越权访问。
6. 人工审查推断是否真的由证据支持。

这时你已经有最小 Agent Loop：读取 → 推断 → 写报告 → 验证 → 修正。

### 阶段 2：把稳定方法抽成 Skill

当同类事故做过两三次，再把重复方法写进 `skills/k8s-diagnosis/SKILL.md`：

```markdown
---
name: k8s-diagnosis
description: Diagnose Kubernetes workload failures from offline evidence.
---

1. 先建立时间线，不先猜根因。
2. 将观察写入“事实”，并引用文件与字段。
3. 为每个候选根因写支持证据和反证。
4. 优先选择能解释全部关键现象的最小假设。
5. 缺少决定性证据时停止，并列出下一项只读采集动作。
6. 禁止连接真实集群或执行变更。
```

此时比较“无 Skill”和“有 Skill”的报告质量。若 Skill 没有提高一致性，它只是更长的 Prompt，不是有效工程资产。

### 阶段 3：用 MCP 替换硬编码工具集成

实现一个**只读** Evidence MCP Server，只暴露窄接口：

- `list_incidents()`：列出可用的脱敏案例；
- `read_evidence(incident_id, artifact)`：读取白名单证据；
- `query_metric(incident_id, metric, start, end)`：查询固定数据集；
- 不提供 `shell`、`kubectl apply` 或任意路径读取。

然后分别接入两个 MCP Host，验证同一个 Server 是否可复用。你由此能清晰解释：MCP 的价值不是“多了一个查询函数”，而是**能力契约与 Host 解耦**。

### 阶段 4：加入 Harness 的生产约束

按风险从低到高增加：

1. 工具参数 Schema 与路径白名单；
2. 最大轮次、Token、费用和墙钟时间；
3. 调用日志、trace ID、工具耗时和错误分类；
4. 只读默认，任何潜在写操作必须人工批准；
5. 重试只用于瞬时错误，并为写操作设计幂等键；
6. 检测相同参数重复调用和连续无进展；
7. 保存输入、版本、输出和评分，保证 Eval 可复现。

### 阶段 5：比较云端与 Ollama 本地模型

在同一组 10 个固定案例上比较，而不是凭聊天手感判断：

| 指标 | 记录方法 |
|---|---|
| 事实准确率 | 正确引用的事实 / 全部事实陈述 |
| 根因命中率 | 与标注根因一致的案例数 |
| 工具成功率 | 成功调用 / 全部工具调用 |
| 越权率 | 触发禁止动作的案例数 |
| 成本与延迟 | 每案例 Token、费用、首字和总耗时 |
| 稳定性 | 同一案例重复 3 次的方差 |

云端模型作为能力基线，再用 Ollama 接入适合本机资源的模型。固定 Prompt、Skill、工具和数据，只替换模型层，才能知道差距来自模型而非 Harness。

### 阶段 6：最后再考虑 Hermes、CC Switch 与多 Agent

- 需要从 Telegram/Slack 长期接收事故材料、跨会话记忆和定时任务时，再评估 Hermes Agent。
- 确实要频繁切换多个 CLI 与供应商时，再评估 CC Switch，并先完成安全审查。
- 只有当“证据采集、诊断、独立审查”能清晰分工且收益可测时，才拆成多 Agent。

推荐的多 Agent 形态是：采集者只能读数据，诊断者只能读已采证据，审查者不能看诊断者的推理过程，只按验收标准独立评分。这比让三个 Agent 自由聊天更可控。

## 九、四周落地节奏

| 周次 | 目标 | 可展示证据 |
|---|---|---|
| 第 1 周 | 单 Agent + 离线故障材料 + 报告 | 3 个案例、报告模板、人工评分 |
| 第 2 周 | 抽取 Skill，补齐 10 个 Evals | Skill 目录、基线对比、失败案例 |
| 第 3 周 | 只读 MCP Server + 两个 Host | Schema、调用 trace、权限测试 |
| 第 4 周 | Harness 约束 + Ollama 对比 | 成本/延迟/正确率表、威胁模型、演示视频 |

每周都遵循同一个学习 Loop：**先预测 → 做最小实验 → 注入故障 → 看证据 → 解释根因 → 固化为文档、测试或工具。**

## 十、选型原则：从问题出发，而不是追热门名词

- 想在真实仓库完成代码任务：先选 Codex、Claude Code 或 Pi 之一。
- 想要最大可改造性和较小核心：研究 Pi。
- 想要长期自托管、消息入口与持久记忆：研究 Hermes Agent。
- 想降低私有数据外发或离线运行：评估 Ollama，但先测能力和硬件成本。
- 多个数据源重复接入多个 Host：使用 MCP。
- 某类任务的方法总要重新解释：沉淀 Skill。
- Agent 偶发失控、不可复现、成本不明：优先补 Harness 和 Evals。
- 多套 CLI 配置切换确实成为痛点：才引入 CC Switch。

真正值得积累的不是“我安装过 11 个工具”，而是：

> **我能说明每一层解决什么问题，能构建最小闭环，能用证据评估效果，也能把权限、失败和成本纳入生产设计。**

## 参考资料

- [Anthropic：Building Effective AI Agents](https://resources.anthropic.com/building-effective-ai-agents)
- [OpenAI Agents SDK：Agents 与 Runner](https://openai.github.io/openai-agents-python/agents/)
- [MCP 官方架构](https://modelcontextprotocol.io/docs/learn/architecture)
- [Agent Skills 规范](https://agentskills.io/specification)
- [OpenAI Codex](https://openai.com/codex/)
- [Anthropic Claude Code](https://github.com/anthropics/claude-code)
- [Pi Agent Harness repository](https://github.com/earendil-works/pi)
- [Nous Research Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent 持久记忆文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)
- [OpenClaw repository](https://github.com/openclaw/openclaw)
- [Goose repository](https://github.com/aaif-goose/goose)
- [OpenHands repository](https://github.com/OpenHands/OpenHands)
- [Ollama Quickstart](https://docs.ollama.com/quickstart)
- [CC Switch repository](https://github.com/farion1231/cc-switch)
- [Google Agent2Agent（A2A）规范](https://google-a2a.github.io/A2A/specification/)
- [LangGraph 官方概览](https://langchain-ai.github.io/langgraph/index.html)
- [vLLM 官方网站](https://vllm.ai/)
- [Langfuse：Tracing、Evaluation 与 Prompt Management](https://langfuse.com/docs)
