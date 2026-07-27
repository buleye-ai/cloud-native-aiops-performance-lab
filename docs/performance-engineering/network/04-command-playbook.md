# 网络排障命令手册

> 命令输出必须带时间戳，并记录执行位置：客户端、服务端、Pod、Node 或网关。

## 1. 接口与路由

```bash
ip -br link
ip -br addr
ip -s link
ip route
ip rule
ip route get <DEST_IP>
ip neigh
```

## 2. DNS

```bash
cat /etc/resolv.conf
cat /etc/nsswitch.conf
getent ahosts example.com
dig example.com
dig @<DNS_IP> example.com
dig +trace example.com
dig +tcp example.com
resolvectl status
resolvectl query example.com
```

## 3. 应用分阶段计时

```bash
curl -sS -o /dev/null \
  -w 'remote=%{remote_ip} code=%{http_code} dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' \
  https://example.com/

openssl s_client -connect example.com:443 -servername example.com
```

固定 IP 但保持 Host/SNI：

```bash
curl --resolve example.com:443:<IP> https://example.com/
```

## 4. 监听与连接状态

```bash
ss -s
ss -lntup
ss -tan
ss -tan state syn-sent
ss -tan state syn-recv
ss -tan state time-wait
ss -tan state close-wait
ss -ti dst <DEST_IP>
```

按状态计数：

```bash
ss -tanH | awk '{print $1}' | sort | uniq -c | sort -nr
```

## 5. 协议栈统计

```bash
nstat -az
sar -n DEV,EDEV,TCP,ETCP 1
cat /proc/net/snmp
cat /proc/net/netstat
netstat -su
```

重点关注：

- `TcpRetransSegs`
- `TcpExtTCPTimeouts`
- `TcpExtListenOverflows`
- `TcpExtListenDrops`
- `UdpRcvbufErrors`
- `IpInDiscards`

## 6. softirq、IRQ 与队列

```bash
mpstat -P ALL 1
cat /proc/softirqs
cat /proc/interrupts
cat /proc/net/softnet_stat
ethtool -l eth0
ethtool -g eth0
ethtool -S eth0
tc -s qdisc show dev eth0
```

`/proc/net/softnet_stat` 是十六进制列，至少观察第二列 drop、第三列 time_squeeze 是否持续增长。

## 7. 延迟、路由与 MTU

```bash
ping -c 10 <IP>
hping3 -S -p 443 -c 5 <IP>
traceroute --tcp -p 443 -n <IP>
mtr -n -r -w -c 100 <IP>
tracepath <IP>
ping -M do -s 1472 <IP>
```

中间跳不回复不等于它在丢转发流量；重点看终点和持续对照。

## 8. 抓包

```bash
# 仅包头，限制 60 秒和轮转空间
timeout 60 tcpdump -i any -nn -s 128 \
  'host <PEER_IP> and port <PORT>' \
  -C 100 -W 3 -w /tmp/net-incident.pcap

# 三次握手
tcpdump -i any -nn 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0'

# DNS
tcpdump -i any -nn 'port 53'

# ICMP/PMTU
tcpdump -i any -nn 'icmp or icmp6'
```

风险：

- pcap 可能含令牌、Cookie、业务数据和用户信息；
- 严格控制权限、范围、留存周期和传输；
- HTTPS 仍暴露元数据，不能当成无敏感信息。

## 9. 防火墙与 NAT

```bash
iptables-save
nft list ruleset
conntrack -S
conntrack -L -p tcp
sysctl net.netfilter.nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
```

大表执行 `conntrack -L` 成本高，应限定协议/地址并避免高峰全量导出。

## 10. Socket 与进程

```bash
lsof -nP -i
strace -f -ttT -e trace=network -p <PID>
pidstat -u -w -p <PID> 1
perf top
```

`strace` 会增加开销，仅短时、定向使用。

## 11. 压测与容量

```bash
iperf3 -s
iperf3 -c <SERVER> -P 4
wrk --latency -t 4 -c 100 -d 30s http://<SERVER>/
```

压测要求：

- 明确授权与流量上限；
- 使用独立压测端，避免客户端先成为瓶颈；
- 同时采集服务端 CPU、softirq、丢包、重传和队列；
- 逐级升压并设置自动停止阈值。

## 12. Kubernetes

```bash
kubectl get pod -o wide
kubectl get svc,endpoints,endpointslice
kubectl get networkpolicy -A
kubectl exec <pod> -- cat /etc/resolv.conf
kubectl exec <pod> -- ip route
kubectl exec <pod> -- ss -s
kubectl debug node/<node> -it --image=nicolaka/netshoot
```

临时调试容器和镜像应符合组织安全策略。

## 13. 常见危险操作

以下操作不能直接在生产执行：

```text
清空全部防火墙规则
全接口无限时长 tcpdump
未经评估关闭 GRO/LRO/TSO/GSO
盲目增大 socket buffer、backlog、conntrack
全局关闭 conntrack
直接修改所有 Pod/节点 MTU
在生产对目标运行 flood 压测
```

所有调参记录：旧值、新值、假设、作用范围、观察指标、回滚命令。

