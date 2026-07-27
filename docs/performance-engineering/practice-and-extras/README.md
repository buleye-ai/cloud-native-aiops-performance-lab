# Linux 性能综合实战、加餐与面试手册

这套资料把课程的综合实战篇与加餐篇合并，服务于三个目标：

1. 生产事故中形成可复用的排障证据链；
2. 用实验真正掌握 CPU、内存、I/O、网络与容器问题；
3. 面试时能讲清原理、方法、案例、权衡和验证。

## 文档导航

| 文档 | 用途 |
|---|---|
| [01-systematic-method.md](01-systematic-method.md) | 从业务现象到根因验证的统一性能方法 |
| [02-comprehensive-incident-sop.md](02-comprehensive-incident-sop.md) | 跨 CPU、内存、I/O、网络、容器的值班 SOP |
| [03-production-cases-and-labs.md](03-production-cases-and-labs.md) | 综合实战、评论区生产案例与实验设计 |
| [04-observability-and-dynamic-tracing.md](04-observability-and-dynamic-tracing.md) | 监控、perf、火焰图、ftrace、eBPF 的使用边界 |
| [05-interview-handbook.md](05-interview-handbook.md) | 高频面试题、结构化回答和项目表达 |
| [06-learning-roadmap.md](06-learning-roadmap.md) | 加餐书单、按需阅读和持续复习路线 |

## 一句话方法

> 先量化业务影响，再用资源全景缩小范围；用逐层指标建立假设，用最小成本工具取证；一次只改一个关键变量，并用同样的负载验证收益与副作用。

## 面试回答模板

```text
背景与业务影响
→ 关键指标和异常时间线
→ 初步假设与排除过程
→ 决定性证据
→ 止损和根因修复
→ 对照验证
→ 监控/容量/流程改进
```

只说“用了 top、perf、tcpdump”不算完整案例；重点是为什么选择它、它证明了什么，以及错误假设如何被排除。

