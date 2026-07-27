# 内存生产案例与评论区经验

## 案例 1：free 很低，于是主动“挤缓存”

### 误区

Linux 会尽量利用空闲内存缓存热点数据。低 `free` 不等于内存紧张，应看 `available`、PSI、回收和 Swap 活动。

清缓存只会让数字好看，并可能造成读延迟和磁盘 I/O 尖峰。

## 案例 2：Redis 内存够用，备份时却出事故

评论用户提到 Redis 默认内存策略导致写入失败，同时 Redis 持久化 fork 可能造成显著瞬时内存峰值。

生产策略：

- 监控 `used_memory`、`used_memory_rss`、碎片率和 fork 指标；
- 配置合理的 `maxmemory` 与淘汰策略；
- 给 fork/COW、复制缓冲和峰值留余量；
- 容器 limit 不能只按平稳 RSS 设置。

## 案例 3：内存泄漏运行 90 天才告警

评论中的真实经历：

- 服务运行约 90 天后泄漏约 800 MiB；
- core 中发现约 3700 万次、每次 20 字节的小对象分配；
- 第三方库符号不完整，直接工具分析受阻；
- 根据平均每小时分配次数关联业务日志量级；
- Review 对应消息处理路径后解决。

经验：

- 小对象慢性泄漏比瞬时暴涨更常见；
- 分配大小、次数、速率比只看总量更容易关联业务；
- 完整符号、日志和历史监控决定事后可诊断性；
- 进程重启只能止损，不能代替根因修复。

## 案例 4：memleak 看不到调用栈

常见原因：

- 程序在容器中，宿主机看不到相同路径的二进制/库；
- 二进制缺少符号或被 strip；
- 内核未启用 `CONFIG_UPROBE_EVENTS`；
- BCC 与内核/headers 不匹配；
- 旧内核不支持所需能力。

替代：

- Java：JFR、jmap、heap dump、async-profiler；
- Go：pprof；
- native：Valgrind、heaptrack、分配器 profiling；
- 老内核动态追踪：SystemTap；
- 生产提前保留 build-id 和符号仓库。

## 案例 5：RSS 汇总超过物理内存

RSS 包含共享页，直接累加会重复计算动态库、共享内存和代码页。统计总进程贡献应使用 PSS。

```bash
grep Pss /proc/[1-9]*/smaps 2>/dev/null |
  awk '{sum+=$2} END{print sum " kB"}'
```

评论也指出课程不同段落对 RSS/共享内存的表述存在口径差异。实际工作以当前工具文档和 `/proc` 字段定义为准。

## 案例 6：Direct I/O 只有 32 MiB/s，缓存后大幅加速

`strace` 发现：

```text
openat(..., O_RDONLY|O_DIRECT)
```

移除 `O_DIRECT` 后读延迟从约 0.9 秒降至约 0.03 秒。

关键修正：

- Direct I/O 是跳过页缓存；
- 裸 I/O 是跳过文件系统；
- `cachetop` 不统计 Direct I/O；
- 不能只看“命中率 100%”，要换算实际命中字节数；
- 数据库等自带缓存管理的程序不一定适合删除 Direct I/O。

## 案例 7：第二次 dd 快到 4.5 GB/s

第二次读取完全命中页缓存，测试的是内存而不是磁盘。用 `dd` 做存储基准时必须明确：

- 冷缓存还是热缓存；
- Buffered 还是 Direct I/O；
- 工作集是否大于内存；
- 被测文件是否已缓存；
- 压测机和目标盘是否隔离。

不要为获得“真实磁盘数字”在生产中随意 `drop_caches`。

## 案例 8：大文件读取把匿名页换入 Swap

大文件扫描使 Buffer/Page Cache 占据大量内存。内存水位下降后，系统在文件页和匿名页之间回收；默认 swappiness 下部分冷匿名页被换出。

表现：

- 缓存持续增长；
- `pages_free` 在 low/high 水位间波动；
- Swap Used 增长；
- 后续访问 dockerd 等冷页时出现主缺页和磁盘读。

这说明“缓存可回收，所以绝不会 Swap”是错误的。

## 案例 9：线上执行 swapoff 清理 Swap

评论询问 `swapoff -a && swapon -a` 的风险。强制换入需要足够物理内存，系统本就有压力时可能导致：

- 直接回收；
- 抖动和长延迟；
- OOM；
- SSH 失去响应。

生产中先计算可换入空间、available、工作集和节点余量；优先迁移流量或扩容。

## 案例 10：Java/ES/Hadoop 与 Swap

JVM GC 需要遍历堆。如果堆页被换出，GC 会触发磁盘 I/O，导致长暂停。ES、Hadoop 等延迟敏感 Java 服务通常建议禁用或锁定 Swap，并正确设置内存。

不能把“关闭 Swap”当万能优化：

- 关闭后匿名页无法被内核换出；
- 真正不足时更快进入 OOM；
- 必须配合容量、限额、GC 和监控。

## 案例 11：Kubernetes 为什么通常要求关闭 Swap

课程评论强调性能与 cgroup 管理。现代 Kubernetes 的具体 Swap 支持会随版本和配置变化，但生产决策仍需明确：

- Pod/节点内存隔离语义；
- kubelet 的 Swap 行为；
- 容器 limit 与 QoS；
- 延迟目标和工作负载类型。

不能仅凭旧课程结论假设所有 Kubernetes 版本都完全不支持 Swap；以集群当前版本配置为准。

## 案例 12：容器 OOM，但主机还有 2 GiB

cgroup OOM 由容器层级达到 `memory.max` 触发，与主机 available 仍有多少不是同一个问题。内存泄漏也可能缓慢增长，监控采样粒度不足时不会看到瞬时尖峰。

证据应查：

```bash
cat /sys/fs/cgroup/memory.events
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max
```

## 案例 13：系统空闲但 Swap 卷持续 3000 IOPS

评论中的 Kubernetes/Ceph 节点业务很少，仍周期性出现 Swap I/O，重启后恢复。作者建议排查 NUMA。

可复用路径：

```text
整机 available
→ 各 NUMA Node free/used
→ zone_reclaim_mode
→ VmSwap 排名前列进程
→ si/so、major faults 和磁盘 I/O
→ CPU/内存亲和性与跨 Node 分配
```

## 案例 14：BCC 在生产装不上

评论指出真实生产常用旧内核且不能升级。正确策略不是在事故中临时升级内核：

- 实验环境用新工具理解指标；
- 生产预装兼容工具；
- 准备 Valgrind/SystemTap/语言 profiler 等替代；
- 内核、headers、BCC 版本必须匹配；
- 工具能力缺失时从 `/proc`、日志和趋势继续推理。

