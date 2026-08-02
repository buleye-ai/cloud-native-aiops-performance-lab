import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(defineConfig({
  lang: "zh-CN",
  title: "Cloud Native AIOps Performance Lab",
  description: "Linux 性能、云原生、可观测性与 AIOps 实战知识库",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  mermaid: {
    securityLevel: "strict",
    theme: "base",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: "basis"
    },
    sequence: {
      useMaxWidth: true
    }
  },
  mermaidPlugin: {
    class: "mermaid"
  },
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "云原生基础", link: "/cloud-native-foundation/" },
      { text: "AI 工程", link: "/ai-engineering/" },
      { text: "性能工程", link: "/performance-engineering/" },
      { text: "思考日志", link: "/thoughts/" },
      { text: "行业与英语", link: "/learning/" },
      { text: "使用指南", link: "/telegram-guide" },
      { text: "建站教程", link: "/site-building-guide" },
      {
        text: "面试",
        link: "/performance-engineering/practice-and-extras/05-interview-handbook"
      },
      {
        text: "GitHub",
        link: "https://github.com/buleye-ai/cloud-native-aiops-performance-lab"
      }
    ],
    sidebar: {
      "/ai-engineering/": [
        {
          text: "AI 工程",
          items: [
            {
              text: "AI Agent 演进与实践",
              link: "/ai-engineering/"
            },
            {
              text: "主流 AI 能力与选型",
              link: "/ai-engineering/mainstream-ai-guide"
            }
          ]
        }
      ],
      "/cloud-native-foundation/": [
        {
          text: "云原生基础",
          items: [
            {
              text: "基础平台",
              link: "/cloud-native-foundation/"
            },
            {
              text: "CrashLoop 实战",
              link: "/cloud-native-foundation/crashloop-incident"
            }
          ]
        }
      ],
      "/performance-engineering/": [
        {
          text: "性能工程",
          items: [
            { text: "总览", link: "/performance-engineering/" }
          ]
        },
        {
          text: "CPU",
          collapsed: true,
          items: [
            { text: "入口", link: "/performance-engineering/cpu/" },
            { text: "心智模型", link: "/performance-engineering/cpu/01-cpu-mental-model" },
            { text: "事故 SOP", link: "/performance-engineering/cpu/02-cpu-incident-sop" },
            { text: "生产案例", link: "/performance-engineering/cpu/03-production-cases" },
            { text: "命令手册", link: "/performance-engineering/cpu/04-command-playbook" },
            { text: "监控与预防", link: "/performance-engineering/cpu/05-monitoring-and-prevention" }
          ]
        },
        {
          text: "内存",
          collapsed: true,
          items: [
            { text: "入口", link: "/performance-engineering/memory/" },
            { text: "心智模型", link: "/performance-engineering/memory/01-memory-mental-model" },
            { text: "事故 SOP", link: "/performance-engineering/memory/02-memory-incident-sop" },
            { text: "生产案例", link: "/performance-engineering/memory/03-production-cases" },
            { text: "命令手册", link: "/performance-engineering/memory/04-command-playbook" },
            { text: "监控与预防", link: "/performance-engineering/memory/05-monitoring-and-prevention" }
          ]
        },
        {
          text: "网络",
          collapsed: true,
          items: [
            { text: "入口", link: "/performance-engineering/network/" },
            { text: "心智模型", link: "/performance-engineering/network/01-network-mental-model" },
            { text: "事故 SOP", link: "/performance-engineering/network/02-network-incident-sop" },
            { text: "生产案例", link: "/performance-engineering/network/03-production-cases" },
            { text: "命令手册", link: "/performance-engineering/network/04-command-playbook" },
            { text: "监控与预防", link: "/performance-engineering/network/05-monitoring-and-prevention" }
          ]
        },
        {
          text: "综合实战与面试",
          collapsed: false,
          items: [
            { text: "入口", link: "/performance-engineering/practice-and-extras/" },
            { text: "系统化方法", link: "/performance-engineering/practice-and-extras/01-systematic-method" },
            { text: "综合 SOP", link: "/performance-engineering/practice-and-extras/02-comprehensive-incident-sop" },
            { text: "案例与实验", link: "/performance-engineering/practice-and-extras/03-production-cases-and-labs" },
            { text: "动态追踪", link: "/performance-engineering/practice-and-extras/04-observability-and-dynamic-tracing" },
            { text: "面试手册", link: "/performance-engineering/practice-and-extras/05-interview-handbook" },
            { text: "学习路线", link: "/performance-engineering/practice-and-extras/06-learning-roadmap" }
          ]
        }
      ]
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/buleye-ai/cloud-native-aiops-performance-lab"
      }
    ],
    search: {
      provider: "local"
    },
    outline: {
      level: [2, 3]
    },
    footer: {
      message: "以原理、实验和证据链构建长期职业资产",
      copyright: "Cloud Native AIOps Performance Lab"
    }
  }
}));
