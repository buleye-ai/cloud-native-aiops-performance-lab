# Linux 网络性能排障手册

本手册面向生产值班与复盘，目标是把“网络慢/网络不通”拆成可验证的问题：

> 业务影响 → DNS/建连/传输/应用阶段 → 客户端/链路/服务端 → 丢包/重传/排队/资源 → 根因 → 止损与验证

## 文档导航

| 文档 | 用途 |
|---|---|
| [01-network-mental-model.md](01-network-mental-model.md) | Linux 收发路径、关键队列、TCP 状态与指标 |
| [02-network-incident-sop.md](02-network-incident-sop.md) | 网络超时、延迟、丢包、连接失败的标准 SOP |
| [03-production-cases.md](03-production-cases.md) | 课程正文、热点评论与现代生产案例 |
| [04-command-playbook.md](04-command-playbook.md) | DNS、路由、套接字、抓包、容器网络命令速查 |
| [05-monitoring-and-prevention.md](05-monitoring-and-prevention.md) | SLI、告警、容量基线、证据留存与预防策略 |

## 30 秒入口

```bash
# 地址、链路、路由
ip -br addr
ip -s link
ip route
ip neigh

# 套接字和 TCP 汇总
ss -s
ss -tan
nstat -az
sar -n DEV,EDEV,TCP,ETCP 1

# DNS、连通与分阶段耗时
dig example.com
curl -sS -o /dev/null \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' \
  https://example.com/

# 内核、队列、丢包
cat /proc/net/softnet_stat
cat /proc/interrupts
tc -s qdisc show
ethtool -S eth0
```

## 第一原则

1. “ping 通”只证明一种 ICMP 路径可用，不代表 DNS、TCP、TLS 或 HTTP 正常。
2. 平均值会掩盖抖动；至少看 p50、p95、p99、超时率与时间线。
3. 丢包位置要分层：应用/套接字、TCP、IP、软中断、qdisc、驱动、网卡、交换网络。
4. 抓包尽量双端同时进行；单端只能看到一半事实。
5. 先取证再调参。不要把 sysctl 清单当成通用优化方案。
6. 容器网络至少多经过 namespace、veth、路由/桥、iptables/nftables 或 eBPF 等路径。
7. DDoS 到达主机后通常只能缓解；带宽型攻击必须在上游清洗。

