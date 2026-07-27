# 内存命令 Playbook

## 1. 系统概览

```bash
free -h
vmstat 1
sar -r -S 1
cat /proc/meminfo
cat /proc/pressure/memory
```

重点：

- `MemAvailable`；
- `Cached/Buffers/SReclaimable/SUnreclaim`；
- `Active/Inactive(anon|file)`；
- `Dirty/Writeback`；
- `AnonPages/Shmem/PageTables/KernelStack`；
- `si/so` 与 PSI。

## 2. 进程排名

```bash
ps -eo pid,ppid,rss,vsz,%mem,comm --sort=-rss | head -30
pidstat -r 1
top -o %MEM
```

单进程：

```bash
cat /proc/<PID>/status
cat /proc/<PID>/smaps_rollup
pmap -x <PID>
```

字段：

- `RssAnon`：匿名常驻页；
- `RssFile`：文件映射常驻页；
- `RssShmem`：共享内存；
- `VmSwap`：该进程已换出；
- `Pss`：按比例分摊共享页后的物理内存。

## 3. 缺页、回收、Swap

```bash
pidstat -r 1
vmstat 1
sar -B 1
sar -W 1
grep -E 'pgfault|pgmajfault|pgscan|pgsteal|pswpin|pswpout' /proc/vmstat
```

Swap 排名：

```bash
smem --sort swap
```

无 smem：

```bash
for f in /proc/[0-9]*/status; do
  awk '/^Name:/{n=$2}/^Pid:/{p=$2}/^VmSwap:/{s=$2}
       END{if(s>0) printf "%10d kB %8s %s\n",s,p,n}' "$f"
done | sort -nr | head
```

## 4. Page Cache

```bash
cachestat 1
cachetop 5
pcstat <file>
grep -E 'Cached|Buffers|Dirty|Writeback' /proc/meminfo
```

确认 Direct I/O：

```bash
strace -f -e trace=open,openat,read,write -p <PID>
```

## 5. Slab 和内核内存

```bash
slabtop
cat /proc/slabinfo
grep -E 'Slab|SReclaimable|SUnreclaim|KernelStack|PageTables' /proc/meminfo
```

## 6. OOM

```bash
dmesg -T | grep -Ei 'out of memory|oom-kill|killed process'
journalctl -k | grep -Ei 'out of memory|oom-kill|killed process'
cat /proc/<PID>/oom_score
cat /proc/<PID>/oom_score_adj
```

不要只保留最后一行 `Killed process`。OOM 前后的内存摘要、约束上下文和调用栈同样重要。

## 7. NUMA

```bash
numactl --hardware
numastat
numastat -p <PID>
cat /proc/sys/vm/zone_reclaim_mode
grep -A 20 'Node .* zone' /proc/zoneinfo
```

## 8. 泄漏工具

native：

```bash
memleak -p <PID>
valgrind --leak-check=full <program>
```

Java：

```bash
jcmd <PID> GC.heap_info
jcmd <PID> GC.class_histogram
jcmd <PID> VM.native_memory summary
jmap -dump:live,format=b,file=heap.hprof <PID>
```

Go：

```bash
go tool pprof http://<host>/debug/pprof/heap
```

使用 heap dump 前评估：

- 是否会 Stop-the-World；
- dump 文件大小和磁盘余量；
- 文件是否含敏感业务数据；
- 是否可在保留的异常副本执行。

## 9. 容器与 Kubernetes

```bash
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.events
cat /sys/fs/cgroup/memory.stat
cat /sys/fs/cgroup/memory.pressure
```

```bash
kubectl top pod <pod> --containers
kubectl describe pod <pod>
kubectl get events --sort-by=.lastTimestamp
```

## 10. 高风险命令

以下操作不能作为常规排障动作：

```bash
echo 3 > /proc/sys/vm/drop_caches
swapoff -a
sysctl -w vm.overcommit_memory=...
sysctl -w vm.min_free_kbytes=...
```

它们会改变现场并可能扩大故障。若确需使用，先评估容量、回滚方式和业务影响。

