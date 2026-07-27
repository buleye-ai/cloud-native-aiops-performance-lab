# CPU 监控、预防与现场保留

## 1. 为什么必须提前监控

CPU、I/O 或网络问题严重时，SSH 本身可能已经不可用。评论中的线上经验指出：恢复服务往往优先于现场排查，事后只能依赖监控、日志和保留的异常实例。

监控必须覆盖系统和应用两个层面。

## 2. 推荐指标

### 业务层

- 请求量、吞吐；
- 错误率、超时率；
- P50/P95/P99；
- 队列长度和拒绝数；
- 依赖调用延迟、错误和连接池；
- 数据库、缓存、消息队列关键指标。

### 系统层

- 每核 `user/system/iowait/irq/softirq/steal/idle`；
- 1/5/15 分钟 Load；
- `procs_running`、`procs_blocked`；
- context switches、interrupts；
- D/Z 进程数；
- 每进程/线程 CPU；
- `NET_RX/NET_TX` 软中断速率；
- 网卡 PPS/BPS、丢包、重传；
- 容器 CPU 使用、quota、throttled seconds；
- 节点 CPU pressure stall information（PSI）。

## 3. 告警原则

不要只告警“CPU > 80%”。推荐组合条件：

```text
业务 P99/错误率异常
AND
CPU 饱和、运行队列、steal、softirq、iowait 或 throttling 中至少一项异常
```

也保留资源预警：

- CPU 长时间接近容量上限；
- Load/CPU 核数持续升高；
- `r/CPU 核数` 持续大于 1；
- 上下文切换相对基线数量级增长；
- 单核热点而整机平均值正常；
- 容器持续被 CPU throttling；
- D/Z 数量持续增长；
- PPS 突增但 BPS 不高。

阈值应由历史基线和 SLO 校准，不照搬其他机器。

## 4. 自动现场保留

告警触发后自动保存 30～120 秒的低开销数据：

```text
top/vmstat/mpstat/pidstat
/proc/softirqs
/proc/interrupts
进程树和线程快照
容器状态与重启次数
最近发布、配置和流量事件
```

可在高严重度时触发短时 profile，但需要预先评估开销、权限和数据合规。

## 5. 容量和发布策略

- 压测机与被测服务分离；
- 优化前后使用相同负载、配置和依赖；
- 为在线流量保留 CPU 余量；
- 监控单核而非只看整机平均值；
- 线程池、连接池和队列设上限；
- 容器同时监控 usage 与 throttling；
- 变更平台记录发布、扩容、配置和依赖事件；
- 灰度阶段自动比较业务指标和 CPU 分类。

## 6. 优化验收模板

| 维度 | 优化前 | 优化后 | 目标 | 结论 |
|---|---:|---:|---:|---|
| QPS |  |  |  |  |
| P95/P99 |  |  |  |  |
| 错误率 |  |  |  |  |
| CPU user/system |  |  |  |  |
| Load、r、cs |  |  |  |  |
| 容器 throttling |  |  |  |  |

优化选择顺序：

1. 影响 SLO 且证据最明确的瓶颈；
2. 收益大、风险低、可回滚的方案；
3. 先消除无效工作，再考虑绑核、NUMA、IRQ 等系统级手段；
4. 避免过早优化和只优化单个数字。

