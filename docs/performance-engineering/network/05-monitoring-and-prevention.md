# 网络监控、告警与预防

## 1. 用业务 SLI 驱动网络排障

主 SLI：

- 成功率、超时率；
- 请求延迟 p50/p95/p99；
- DNS、connect、TLS、TTFB 分阶段延迟；
- RPS/并发数；
- 按区域、运营商、集群、节点、实例拆分。

网络指标只能解释业务影响，不能替代业务 SLI。

## 2. 主机指标

### 网卡

- RX/TX BPS、PPS；
- errors、dropped、missed、fifo、carrier；
- 带宽利用率；
- qdisc backlog/drop；
- NIC ring drop。

### 协议栈

- TCP active/passive opens；
- retrans、timeouts、listen overflow/drop；
- SYN_RECV、TIME_WAIT、CLOSE_WAIT；
- UDP receive/send buffer errors；
- ICMP 错误；
- softnet drop/time_squeeze。

### CPU

- softirq 总量与各核分布；
- NET_RX/NET_TX；
- IRQ 亲和性；
- 上下文切换；
- NUMA 与应用线程位置。

## 3. DNS 指标

- 查询 QPS；
- 成功、NXDOMAIN、SERVFAIL、timeout；
- p50/p95/p99；
- 缓存命中率；
- 上游延迟和错误；
- UDP/TCP 查询比例；
- CoreDNS CPU、内存、并发和队列。

告警应组合“延迟/错误 + 流量”，低流量时单次错误不应制造风暴。

## 4. Kubernetes/CNI 指标

- Pod/Node 维度丢包、重传；
- veth drop；
- CNI agent 健康；
- Service 后端数量与无端点事件；
- NetworkPolicy 拒绝；
- conntrack 使用率；
- SNAT 端口使用率；
- CoreDNS/NodeLocal DNS；
- 跨节点与跨可用区 RTT。

## 5. 推荐告警组合

阈值应来自本系统基线，以下是逻辑而非固定数值：

```text
业务超时率升高
AND (connect 延迟升高 OR TCP timeout/retrans 升高)
```

```text
RX PPS 异常
AND softirq 升高
AND (softnet drop 增长 OR SYN_RECV 激增)
```

```text
DNS p99 升高
AND (SERVFAIL/timeout 升高 OR upstream latency 升高)
```

```text
nf_conntrack_count / nf_conntrack_max 接近容量
AND 新连接失败增长
```

避免只对“重传率 > 0”“TIME_WAIT 很多”“ping 丢一个包”告警。

## 6. 自动证据包

告警触发后自动保存 5–10 分钟的小型快照：

```text
时间线与变更
curl 分阶段耗时
ss -s / ss -ti
nstat 差值
sar DEV/EDEV/TCP/ETCP
softnet_stat 差值
ip -s link / ethtool -S 差值
路由、邻居、qdisc
conntrack 使用率
Pod/Node/Service/Endpoint 信息
```

使用“差值”而不是累计计数绝对值。

抓包不应默认自动开启；如需自动化，必须限定 BPF、时长、大小、权限和脱敏流程。

## 7. 容量基线

每类服务至少记录：

| 负载点 | RPS | p99 | 错误率 | BPS/PPS | CPU/softirq | 重传 | 连接数 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 日常 |  |  |  |  |  |  |  |
| 峰值 |  |  |  |  |  |  |  |
| 极限前一档 |  |  |  |  |  |  |  |

容量结论必须包含客户端、LB、NAT、DNS、节点与应用，而不只是应用 RPS。

## 8. 预防策略

### 应用

- 连接池、Keep-Alive、合理超时和重试预算；
- 指数退避与抖动，避免重试风暴；
- DNS TTL 感知和缓存更新；
- 记录分阶段延迟与上游地址；
- 限流、熔断、隔离和背压。

### 系统

- 按压测结果配置 backlog、buffer 与 conntrack；
- 网卡多队列、IRQ/RPS/RFS/XPS 与 NUMA 联合验证；
- 配置统一 MTU；
- 保持内核、驱动与 CNI 的受支持版本；
- 所有 sysctl 纳入配置管理和变更审计。

### 架构

- 多 DNS 上游与本地缓存；
- 多可用区入口与健康检查；
- CDN/WAF/DDoS 清洗预案；
- 分散 NAT 网关和出口地址；
- 预留带宽、PPS 和连接容量；
- 定期故障演练：DNS 故障、丢包、延迟、conntrack 满、节点失联。

## 9. 复习清单

每次复习应能回答：

1. 如何用一次 `curl` 区分 DNS、TCP、TLS、TTFB？
2. PPS 高而 BPS 低为什么会打满 softirq？
3. TCP 重传如何用双端抓包定位？
4. `SYN_RECV`、`TIME_WAIT`、`CLOSE_WAIT` 各意味着什么？
5. 为什么 Nagle 与 Delayed ACK 会产生固定延迟？
6. 容器访问 Service 经过哪些额外路径？
7. conntrack 满与临时端口耗尽有什么不同？
8. 为什么 DDoS 到主机后通常只能缓解？
9. 如何识别 MTU 黑洞？
10. 一个网络调参如何证明有效且没有副作用？

