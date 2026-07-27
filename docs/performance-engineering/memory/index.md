# Linux 内存性能排障手册

本手册面向生产环境，目标是把“内存高了”拆成可验证的问题：

> 业务影响 → 系统还是容器 → 可用内存与压力 → 内存类型 → 进程/缓存/内核 → 分配调用栈 → 根因 → 止损与验证

## 文档导航

| 文档 | 用途 |
|---|---|
| [01-memory-mental-model.md](01-memory-mental-model.md) | 虚拟内存、页、RSS/PSS、Cache、回收、Swap 与 OOM |
| [02-memory-incident-sop.md](02-memory-incident-sop.md) | 生产内存告警的标准处置流程 |
| [03-production-cases.md](03-production-cases.md) | 课程正文与评论区的真实案例和易错点 |
| [04-command-playbook.md](04-command-playbook.md) | 按问题类型组织的命令速查 |
| [05-monitoring-and-prevention.md](05-monitoring-and-prevention.md) | 监控、告警、容器限制、现场保留和容量策略 |

## 30 秒入口

```bash
# 系统趋势
free -h
vmstat 1
sar -r -S 1
cat /proc/meminfo

# 进程与地址空间
pidstat -r 1
ps -eo pid,ppid,rss,vsz,%mem,comm --sort=-rss
pmap -x <PID>
cat /proc/<PID>/smaps_rollup

# 内存压力、回收、Swap、OOM
cat /proc/pressure/memory
cat /proc/vmstat
grep -E 'pgmajfault|pgscan|pgsteal|pswpin|pswpout|oom' /proc/vmstat
dmesg -T | grep -Ei 'out of memory|oom-kill|killed process'

# 容器
cat /sys/fs/cgroup/memory.events
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max
```

## 第一原则

1. 看 `available` 和内存压力，不只看 `free`。
2. 看趋势，不用单个快照判断泄漏。
3. VIRT 大不等于物理内存大，RSS 相加会重复统计共享页。
4. 先区分主机 OOM、cgroup OOM、应用自身限制和语言运行时 OOM。
5. Swap 已用量是存量；持续的 `si/so`、主缺页与延迟才说明当前抖动。
6. 不在未确认物理内存余量时直接 `swapoff -a`。

