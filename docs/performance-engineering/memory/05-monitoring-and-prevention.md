# 内存监控、预防与现场保留

## 1. 监控目标

内存事故通常不是突然发生：

- 泄漏可能持续数周；
- Swap 可能每天只增长几十 MiB；
- 容器 limit 可能只在峰值或 fork 时越界；
- Page Cache 和 Slab 会随工作集缓慢变化。

因此必须保存趋势，不能只依赖事故时的 `free`。

## 2. 主机指标

- MemAvailable、used、free；
- Active/Inactive anon/file；
- Cached、Buffers；
- SReclaimable、SUnreclaim；
- Dirty、Writeback；
- AnonPages、Shmem；
- PageTables、KernelStack；
- minor/major faults；
- direct reclaim、pgscan、pgsteal；
- Swap used、swap in/out；
- memory PSI some/full；
- OOM 次数和受害者；
- 各 NUMA Node 内存。

## 3. 进程与应用指标

- RSS、PSS、Swap；
- 匿名页、文件页、共享内存；
- 分配速率与释放速率；
- GC 次数、暂停、堆使用和堆外内存；
- 线程数和栈内存；
- 缓存大小、命中率和淘汰；
- mmap/共享内存；
- 重启次数、OOMKilled；
- fork/COW 峰值。

## 4. 容器指标

- `memory.current/max/high/low/min`；
- `memory.events` 中 high、max、oom、oom_kill；
- anon、file、kernel、slab、sock；
- cgroup memory PSI；
- working set 与 RSS；
- request/limit 和节点可分配内存；
- 同节点所有 Pod 的峰值叠加。

Kubernetes 告警应同时带上 QoS、request、limit、节点余量和重启原因。

## 5. 告警组合

不要只告警“内存使用率 > 90%”。

推荐：

```text
MemAvailable 持续低
AND
(memory PSI / major faults / direct reclaim / swap-in / 业务延迟 至少一项异常)
```

泄漏预警：

```text
同等负载下，进程 PSS 或 anon RSS 在多个窗口单调增长且没有平台期
```

容器：

```text
memory.current 接近 memory.max
OR memory.events:high/max/oom 增长
```

Slab：

```text
SUnreclaim 持续增长且无法由连接数、文件数或工作负载解释
```

## 6. 自动现场保留

告警触发后保存：

```text
free、vmstat、sar、PSI
/proc/meminfo、/proc/vmstat
进程 RSS/PSS/VmSwap 排名
异常 PID 的 smaps_rollup 和 pmap
cgroup memory.events/stat
OOM 完整内核日志
最近发布、配置、流量、批任务和重启事件
```

慢性泄漏应周期性采样 PSS、语言堆和分配热点，避免等到 OOM 后进程现场消失。

## 7. 容量规划

容量不能只取稳定平均 RSS：

```text
工作集
+ Page Cache/内核开销
+ GC/分配波动
+ fork/COW 或备份峰值
+ 并发增长
+ 安全余量
```

容器 request 用于调度，limit 用于边界，两者应分别根据稳定工作集和风险上限设计。

## 8. 开发与发布预防

- native 代码在 CI 运行 ASan/LSan/Valgrind；
- Java/Go 等启用可控的持续剖析；
- 保存 release 对应符号和 build-id；
- 异常路径与成功路径都做资源释放；
- 使用 RAII、智能指针、defer 或作用域管理；
- 高峰压测覆盖缓存、GC、fork、重载和回滚；
- 灰度比较 PSS、分配率、major faults、PSI 与尾延迟；
- 限制无限队列、无限缓存和无界并发。

## 9. 优化验收

| 维度 | 优化前 | 优化后 | 目标 | 结论 |
|---|---:|---:|---:|---|
| P95/P99、错误率 |  |  |  |  |
| PSS/RSS/anon |  |  |  |  |
| major faults |  |  |  |  |
| PSI some/full |  |  |  |  |
| Swap in/out |  |  |  |  |
| GC/分配率 |  |  |  |  |
| Cache 命中率 |  |  |  |  |
| OOM/restart |  |  |  |  |

内存优化的最终目标不是让 used 最低，而是：

- 热点工作集留在内存；
- 减少主缺页、直接回收和交换；
- 在稳定容量内满足业务 SLO；
- 故障边界清晰且不会拖垮整机。

