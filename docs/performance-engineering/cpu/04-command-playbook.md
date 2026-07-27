# CPU 命令 Playbook

## 1. 最小采集集

```bash
date
uname -a
nproc
uptime
top -b -H -n 1
vmstat 1 5
mpstat -P ALL 1 5
pidstat -u -w -t 1 5
```

## 2. 指标到工具

| 目标 | 首选 | 下钻 |
|---|---|---|
| 平均负载 | `uptime`, `top` | `vmstat r/b` |
| 每核 CPU | `mpstat -P ALL 1` | IRQ/亲和性 |
| 进程 CPU | `pidstat -u 1` | `perf`, 语言工具 |
| 线程 CPU | `pidstat -u -t 1` | `top -H`, 线程栈 |
| 上下文切换 | `vmstat 1` | `pidstat -w -t 1` |
| D/Z 状态 | `top`, `ps` | `wchan`, `/proc/PID/stack`, `pstree` |
| 短命进程 | `execsnoop` | `perf`, 审计/日志 |
| 软中断 | `/proc/softirqs` | `sar`, `tcpdump` |
| 硬中断 | `/proc/interrupts` | IRQ、网卡队列、亲和性 |
| 调用链 | `perf record/report` | 火焰图、语言 profiler |

## 3. 常用命令

### CPU 和调度

```bash
mpstat -P ALL 1
vmstat 1
pidstat -u -w 1
pidstat -u -w -t 1
ps -eLo pid,ppid,tid,psr,state,pcpu,comm --sort=-pcpu
```

### D/Z 状态

```bash
ps -eo state,pid,ppid,wchan:32,comm | awk '$1 ~ /D|Z/'
cat /proc/<PID>/stack
pstree -ap <PPID>
iostat -xz 1
pidstat -d 1
```

### 中断和网络

```bash
watch -d cat /proc/softirqs
watch -d cat /proc/interrupts
sar -n DEV 1
ethtool -S <NIC>
ss -s
tcpdump -i <NIC> -nn -c 200
```

### perf

```bash
# 进程，15 秒，99 Hz
perf record -F 99 -g -p <PID> -- sleep 15

# 整机，15 秒
perf record -F 99 -g -a -- sleep 15

perf report

# 低于默认 0.5% 的调用图也显示
perf report -g graph,0.3
```

`Self` 是函数自身消耗；`Children` 包含其直接和间接子调用。

## 4. Java

```bash
top -H -p <PID>
printf '%x\n' <TID>
jstack <PID>
```

常用工具组合：

- `jstack`：锁、线程状态、热点 TID 对应；
- JFR：低开销持续事件；
- async-profiler：CPU、锁、分配、墙钟；
- APM/持续剖析：保存故障时刻历史。

## 5. 使用约束

- `vmstat/pidstat` 主要读取 `/proc`，开销通常很低；
- `perf/strace/tcpdump` 会增加开销或产生敏感数据，只做范围明确、限时采样；
- 不在生产中无限期 `perf record`；
- 抓包限制接口、端口、包数和保存权限；
- 不随意修改 `perf_event_paranoid`、`kptr_restrict`；
- 命令失败先查 `man`、版本和权限，不要为了得到预期截图反复加压。

