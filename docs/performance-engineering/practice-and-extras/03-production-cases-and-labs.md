# 综合生产案例、评论区经验与实验

## 案例 1：Tomcat 容器启动 22 秒并 OOM

### 证据链

```text
请求 reset/refused
→ 容器 Exit 137
→ inspect: OOMKilled=true
→ dmesg: mem_cgroup_out_of_memory
→ JVM 最大堆超过容器限制
→ 修正运行时内存配置
→ pidstat 发现 %wait 很高
→ CPU quota 只有 0.1 核
→ 提升合理 quota 后启动约 2 秒
```

### 评论区与现代生产修正

- `/proc` 看到的是主机视图、cgroup 才是限制来源，这是早期容器常见认知坑。
- `-Xmx=512m` 与容器限制同为 512MiB 仍可能 OOM，因为非堆、线程栈、直接内存和 native 内存也要空间。
- 现代 JVM 通常容器感知，但必须检查实际版本与最终参数，不能假定。
- 资源限制不能全部去掉；否则一个异常容器可能拖垮整个节点。

### 实验

对同一 Java 服务设置不同 CPU quota 和内存限制，记录：

- 启动时长；
- `cpu.stat` 的 throttled 时间；
- RSS、heap、native memory；
- readiness 到首次成功请求的时间。

## 案例 2：端口正常但 HTTP 超时

### 证据链

```text
hping3 SYN 正常
→ curl GET 超时
→ tcpdump 三次握手正常但看不到 GET
→ 网卡 RX drop 增长
→ MTU 被配置为 100
→ 修正 MTU 后恢复
```

结论：端口可建连不等于应用数据能传输，小包正常也不代表大包正常。

### 评论区扩展

- Kubernetes 曾出现 netfilter 模块未随系统启动加载，Service 流量到 Pod 后目的地址未正确转换。
- veth、隧道和物理链路的分片行为不同，不能简单套用“IP 会自动分片”。
- 还要检查双工/速率不匹配、线缆、广播风暴和交换机端口错误。

## 案例 3：随机丢包来自防火墙规则

`iptables -nvL` 的 DROP/REJECT 计数非零，最终发现随机丢弃 30% 报文的规则。

生产经验：

- 不只阅读规则，还要看计数器是否增长；
- 同时检查 nftables、iptables-nft、云安全组与 eBPF 策略；
- tcpdump 在丢弃点之前或之后看到的结果不同；
- conntrack 是主机全局还是 namespace 级，要按内核实现确认，现代环境还要区分 zone。

## 案例 4：吞吐优化越做越“高”，成功请求却很少

Nginx + PHP 案例依次暴露：

1. conntrack 上限 200，日志出现 table full；
2. PHP-FPM `max_children=5`；
3. listen backlog 与 `somaxconn=10`；
4. 临时端口范围只有约 50 个；
5. 最终 CPU/sys/softirq 成为新瓶颈，需要火焰图。

关键经验：

- 优化会移动瓶颈；
- 每解开一层限制，都要重新做全景观测；
- RPS 上升但 499、5xx 或超时未下降，不是成功；
- 增大队列只会允许更多等待，消费者能力不足时会放大尾延迟。

## 案例 5：kworker CPU 100%

评论区真实场景中，Docker 主机无法创建容器，同时 `kworker/u*` 长期占用 CPU，最后通过重启恢复。

正确的后续动作不应止于“重启解决”：

- 保存 `dmesg`、hung task、workqueue、块设备和驱动日志；
- 查看进程 `wchan`、内核栈和 perf；
- 关联 Docker/存储/网络设备事件；
- 检查重启前后内核和驱动版本；
- 建立复发时自动取证。

## 案例 6：动态追踪看到了地址，看不到 Java 函数

评论区使用 `perf --symfs` 后仍只看到 JVM 地址。原因通常是 JIT 代码没有普通 ELF 符号。

处理：

- async-profiler/JFR；
- perf-map-agent 或 JIT dump；
- 保留 frame pointer 或使用 DWARF；
- 确认容器 rootfs、PID namespace 和符号文件；
- 不把 `[unknown]` 直接解释成内核或第三方库问题。

## 案例 7：Serverless/FaaS 冷启动

不能只看容器进程启动：

```text
调度与节点容量
→ 镜像拉取/解压
→ sandbox/微虚机
→ CNI/CSI
→ 运行时初始化
→ 代码和依赖加载
→ JIT/连接预热
→ readiness/首个请求
```

面试中应说明如何给每阶段埋点，以及预热、镜像瘦身、快照、连接复用和容量保留之间的成本。

## 综合实验设计

### 实验 A：资源限制

- 对 CPU-bound 服务设置 0.1/0.5/1/2 核；
- 比较使用率与 throttle；
- 解释为什么整机 CPU 空闲时容器仍慢。

### 实验 B：OOM

- 设置容器内存；
- 逐步增大 heap/native/直接内存；
- 区分应用 OOM、cgroup OOM、主机 OOM。

### 实验 C：网络丢包

- 用 `tc netem` 在隔离环境注入延迟和丢包；
- 双端抓包；
- 比较 TCP 重传、UDP 错误和应用 p99。

### 实验 D：吞吐瓶颈阶梯

- 逐步限制 worker、backlog、conntrack、端口；
- 每次只改一项；
- 绘制有效吞吐与 p99 曲线；
- 用火焰图确认最终 CPU 热点。

### 实验 E：动态追踪

- perf 找 CPU 热点；
- eBPF 找调度和 I/O 延迟；
- 与应用 profiler 结果交叉验证；
- 测量工具本身开销。

