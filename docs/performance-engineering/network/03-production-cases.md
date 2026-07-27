# 网络生产案例与评论区经验

## 案例 1：容器能 ping IP，却解析不了域名

### 现象

`ping <DNS_IP>` 正常，`nslookup` 超时。

### 证据

调试输出显示请求发往 `127.0.0.1:53`，容器 `/etc/resolv.conf` 为空或错误。

### 结论

“IP 连通”与“DNS 可用”是两个问题。先检查容器实际看到的配置，而不是只看宿主机。

### 生产扩展

Kubernetes 还要检查 CoreDNS、NodeLocal DNSCache、`ndots`、search 域和 NetworkPolicy。

## 案例 2：远端公共 DNS 让解析从毫秒变成十几秒

DNS 请求默认多使用 UDP。到上游存在高 RTT 或丢包时，会等待重试和超时，形成 5s/10s/15s 级长尾。

处置：

- 用 `dig @server` 分别测试各上游；
- 选择网络距离更近且稳定的 DNS；
- 开启合适的本地缓存；
- 监控缓存命中、上游延迟、SERVFAIL/NXDOMAIN；
- 不要把一次 `ping` 成功当作稳定性证明。

评论区实测：dnsmasq 首次查询约数百毫秒，缓存命中可降到数毫秒。实际配置还必须保留健康的 upstream DNS。

## 案例 3：`nslookup` 正常但应用或 `ping hostname` 失败

`nslookup/dig` 直接查询 DNS；应用通常经过 NSS：

```text
应用 → getaddrinfo → /etc/nsswitch.conf
→ files / dns / systemd-resolved / mDNS ...
```

排查时对比：

```bash
dig example.com
getent ahosts example.com
cat /etc/nsswitch.conf
```

还要考虑 IPv4/IPv6、search 域、代理和应用自带 DNS 缓存。

## 案例 4：SYN Flood 导致正常用户无法建连

### 现象

- PPS 达到数万，小包占主导；
- `SYN_RECV` 激增；
- SSH 和 HTTP 均超时；
- `softirq` 高。

### 证据链

```text
sar：PPS 异常
→ tcpdump：大量 SYN
→ ss/netstat：大量 SYN_RECV
→ 源地址/报文分布
```

### 处置层级

主机限速与 SYN cookies只能缓解；多源大流量必须上移到云清洗、运营商、CDN/WAF 或专用设备。

## 案例 5：`REJECT` 后仍慢，换 `DROP` 才恢复

热点评论中的实测表明，`REJECT` 仍会生成 ICMP/TCP 响应，在高 PPS 下消耗 CPU 与出口；`DROP` 不回复，成本更低。

这不是说所有防火墙都该使用 `DROP`。正常运维访问使用 `REJECT` 更易诊断；明确的攻击流量更适合尽早静默丢弃。

## 案例 6：网卡多队列缓解单核 softirq，但不是免费优化

生产评论案例：

- 单进程业务看似打满一个 CPU；
- `/proc/softirqs` 显示网络软中断集中；
- 调整多队列和 IRQ 亲和性后业务缓解。

副作用：

- 更多 CPU 被网络处理占用；
- 跨 CPU 迁移可能降低缓存局部性；
- RPS/RFS/XPS、应用线程和 NUMA 不匹配可能更差。

验证必须同时看吞吐、p99、softnet drop、各核 softirq 和 CPU 利用率。

## 案例 7：并发一上来固定多出约 40ms

课程案例中：

- 单请求建连延迟正常；
- 并发 HTTP 延迟从约 9ms 增到约 44ms；
- 抓包看到客户端约 40ms 后才 ACK；
- 服务端 Nagle 等待 ACK 后才发送第二个小分组。

根因是 Nagle 与 Delayed ACK 组合。Nginx 开启 `tcp_nodelay` 后恢复。

注意：

- `TCP_QUICKACK` 不是永久开关，且客户端经常不可控；
- 关闭 Nagle 会增加小包和 PPS；
- 必须抓包确认，不要仅凭“40ms”调参。

## 案例 8：低概率 Go HTTP 请求卡在 write/EAGAIN

评论案例表现：

- `write` 返回 `EAGAIN`，等待 epoll 可写；
- send buffer 有数据，出现重传；
- 最终达到 RTO 次数后断开。

作者建议回到重传根因，并进行双端抓包。常见方向：

- 中间链路丢包或黑洞 MTU；
- 对端读取慢、零窗口；
- 本机/对端资源上限；
- NAT/防火墙丢状态；
- 突发拥塞和队列丢包。

缩短 RTO 只能更快失败，不是修复网络。

## 案例 9：直接访问 30ms，经过 Nginx/Lua 变 200ms

需要分解代理每一段：

```text
客户端 → Nginx 排队 → Lua
→ 本地缓存 → Redis → MySQL/上游
→ 响应发送
```

结合 `$request_time`、`$upstream_connect_time`、`$upstream_header_time`、`$upstream_response_time`，再用火焰图/动态追踪定位 Lua、锁、GC 和系统调用。

## 案例 10：TIME_WAIT 很多不等于故障

PHP/代理/Redis/MySQL 场景中，短连接会产生大量 `TIME_WAIT`。正确顺序：

1. 确认谁是主动关闭方；
2. 检查是否缺少连接池/Keep-Alive；
3. 检查临时端口范围和 NAT；
4. 评估请求失败是否真的由端口耗尽导致；
5. 再考虑安全的内核参数。

禁止照抄旧文章中的 `tcp_tw_recycle`；它已被移除且会破坏 NAT 客户端。

## 案例 11：conntrack 表满导致“偶发网络不通”

典型特征：

- 老连接正常，新连接随机失败；
- 节点日志出现 table full；
- `nf_conntrack_count` 接近 `nf_conntrack_max`；
- Kubernetes Service/出口 NAT 更明显。

修复不能只扩大表：

- 减少短连接并使用连接池；
- 调整不必要的状态跟踪；
- 合理设置超时；
- 分散出口；
- 评估每表项内存成本。

## 案例 12：MTU 不一致导致小包正常、大包超时

典型表现：

- ping 默认尺寸正常；
- TLS、上传或特定响应大小卡住；
- 隧道/VXLAN/WireGuard 环境常见；
- ICMP “fragmentation needed” 被过滤时形成 PMTU 黑洞。

检查：

```bash
tracepath <DEST>
ping -M do -s <SIZE> <DEST>
ip link
```

统一底层与 overlay MTU，或正确设置 MSS clamp。不要盲目把所有接口改成 1500。

## 案例 13：抓包显示怪异大包，不一定线上真的如此

GRO/LRO 会在接收侧聚合，TSO/GSO 会在发送侧延后分段。主机抓包可能看到超过 MTU 的“包”。

对策：

- 明确抓包点；
- 检查 `ethtool -k`；
- 优先双端抓包；
- 必要时在隔离环境临时关闭 offload 验证，生产修改前评估 CPU 影响。

## 案例 14：DDoS 防御最终选择云高防

评论区实际经历：业务曾遭遇几十 Gbps 攻击，早期通过切换负载均衡 IP 打游击；业务扩大后切 IP 的协调和白名单成本过高，最终购买云高防。

经验：

- 防护成本要与停机损失比较；
- 提前准备备用入口、DNS TTL、白名单和演练；
- 被攻击时临时设计方案通常来不及；
- 不向攻击者付款，保存证据并联动云厂商/运营商。

