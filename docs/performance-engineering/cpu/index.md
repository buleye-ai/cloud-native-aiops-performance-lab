# Linux CPU 性能排障手册

这是一套面向生产环境的 CPU 问题诊断资料。目标不是记忆命令，而是形成稳定的证据链：

> 业务影响 → 系统现象 → 指标分类 → 进程/线程 → 调用链或外部资源 → 根因 → 止损 → 验证

## 文档导航

| 文档 | 用途 |
|---|---|
| [01-cpu-mental-model.md](01-cpu-mental-model.md) | CPU 指标、进程状态和上下文切换的心智模型 |
| [02-cpu-incident-sop.md](02-cpu-incident-sop.md) | 生产 CPU 告警的标准处置流程 |
| [03-production-cases.md](03-production-cases.md) | 正文和评论区中的真实案例、误区与修复 |
| [04-command-playbook.md](04-command-playbook.md) | 按场景组织的命令速查手册 |
| [05-monitoring-and-prevention.md](05-monitoring-and-prevention.md) | 监控、告警、现场保留和容量策略 |

## 30 秒入口

```bash
# 总体趋势
uptime
top
vmstat 1
mpstat -P ALL 1

# 进程、线程、上下文切换
pidstat -u -w 1
pidstat -u -w -t 1

# 状态和短命进程
ps -eLo state,pid,ppid,tid,psr,pcpu,wchan:32,comm --sort=-pcpu
execsnoop

# 软中断、网络小包
watch -d cat /proc/softirqs
sar -n DEV 1

# 调用链（生产环境必须限时）
perf record -F 99 -g -a -- sleep 15
perf report
```

## 第一原则

1. 先确认业务影响，再处理 CPU 数字。
2. 先用低开销工具缩小范围，再使用 `perf` 等动态追踪工具。
3. 不以单个瞬时值定性，必须与历史基线、业务流量和同配置实例对比。
4. 故障期间优先恢复服务，但恢复前尽可能留下低风险现场。
5. 没有优化前后的同负载对比，就不能证明优化有效。

