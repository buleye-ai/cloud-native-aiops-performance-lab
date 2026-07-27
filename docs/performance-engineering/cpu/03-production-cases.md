# CPU 生产案例与评论区经验

## 案例 1：线程很多，进程级指标却不高

### 现象

- `vmstat cs` 从几十升到百万级；
- `sy` 达到 80% 以上；
- 运行队列远超 CPU 数；
- `pidstat -w` 的进程切换加起来却只有几百。

### 根因

Linux 调度单位是线程，主线程指标掩盖了子线程的切换。

### 证据

```bash
pidstat -w -t 1
```

### 经验

- 上下文切换看趋势和数量级，不能跨机器套绝对阈值；
- `r`、`sy`、吞吐下降与切换增长要联合判断；
- CentOS/旧 sysbench 参数可能不同，先 `man` 和检查版本。

## 案例 2：Tomcat 16 核全部接近 98%

评论用户在线上使用课程方法和 Java 工具，最终定位到具体问题线程与函数。

可复用路径：

```text
整机 CPU → Java PID → 热点 TID → 十六进制 nid → jstack/APM/async-profiler → 问题函数
```

```bash
top -H -p <JAVA_PID>
printf '%x\n' <TID>
jstack <JAVA_PID>
```

生产中优先使用已经部署的 APM 或持续剖析；现场采样必须限时。

## 案例 3：系统 CPU 80%，进程列表没有“大户”

### 现象

- `us` 约 80%，`sy` 约 15%；
- 所有常驻进程都只有几个百分点；
- `top` 偶尔出现 `stress`，但 PID 每次都不同。

### 根因

PHP 每个请求调用外部命令。命令因权限错误高速失败退出，形成大量短命进程。

### 证据链

```text
top 的 R 状态异常
→ PID 不断变化
→ pstree 找到父进程
→ execsnoop 记录 exec
→ 应用错误输出出现 Permission denied
→ perf 确认 CPU 热点
```

### 生产迁移

同类根因还包括：

- 程序崩溃后被 systemd/supervisor/Kubernetes 拉起；
- health check 或定时任务高频执行命令；
- CGI、shell、图片/视频转换子进程；
- 日志轮转或压缩任务。

## 案例 4：Load 高、CPU 不高、D 进程很多

### 现象

- Load 接近或超过 CPU 数；
- `us/sy` 低；
- `wa` 高或存在大量 `D`；
- 单个进程 CPU 很低。

### 根因方向

直接 I/O、块设备延迟、存储限速或设备/文件系统等待。

### 评论区修正

- D 状态“不可中断”是不能被普通信号打断，不是霸占 CPU；
- cgroup IOPS 限制能让容器任务等待，但物理设备本身仍可能空闲；
- 不同 SSD/HDD/NVMe 性能差异会让同一压测表现完全不同；
- 测试程序若只识别 `/dev/sd*` 或 `/dev/xvd*`，在 `/dev/vd*`、`/dev/nvme*` 上可能直接退出；
- 应显式指定设备、块大小、次数，并检查应用日志。

生产中不要盲目 `kill -9` D 进程。先查等待点和下层存储；进程只有在内核等待返回后才能真正处理信号。

## 案例 5：僵尸进程不断增长

### 根因

父进程未调用 `wait()/waitpid()`，或没有正确处理 `SIGCHLD`。

### 处置

```bash
ps -eo stat,pid,ppid,comm | awk '$1 ~ /Z/'
pstree -ap <PPID>
```

修复父进程，而不是对已经退出的子进程反复 `kill`。容器 PID 1 应具有子进程回收能力，可使用合适的 init。

## 案例 6：软中断不高，SSH 仍非常卡

### 现象

- CPU 看起来并不忙；
- `si` 只有几个百分点；
- `NET_RX` 快速增长；
- PPS 高、BPS 不高；
- SSH 延迟和丢包明显增加。

### 根因

大量 SYN 小包占用网络队列和处理路径。卡的是 SSH 网络链路，不是本地键盘或必须先打满 CPU。

### 证据

```bash
watch -d cat /proc/softirqs
sar -n DEV 1
tcpdump -i eth0 -nn tcp port 80
ping -c 3 <host>
```

单个 SYN 包不能证明 SYN Flood；必须结合持续 PPS、包型分布和来源统计。

## 案例 7：perf 里 swapper 最大

`swapper` 与交换分区无关，它是 CPU 没有其他工作时执行的空闲任务。比例高通常说明 CPU 很闲，不是根因。

这解释了为什么不能一上来只看 `perf` 最大项：事件多不等于性能瓶颈。应先用 `top/vmstat/pidstat` 确定方向。

## 案例 8：容器 perf 只有十六进制地址

原因通常是宿主机找不到容器内的库和符号，或构建时被 `strip`。

可选方案：

1. 使用 `--symfs` 指向容器根文件系统；
2. 宿主机采集 `perf.data`，在包含相同库和符号的容器环境解析；
3. 保留可匹配的调试符号和 build-id；
4. 不建议为了方便直接长期降低生产主机安全限制。

容器中的 perf 版本还要和宿主机内核兼容。

## 案例 9：Java perf 没有 Java 方法

JIT 代码需要符号映射，例如 `/tmp/perf-<PID>.map`；完整栈还可能需要：

```text
-XX:+PreserveFramePointer
```

可结合 `perf-map-agent`，生产中通常更适合使用 async-profiler 或持续剖析平台。

## 案例 10：实验与教程结果不一致

评论区最普遍的问题不是原理，而是环境：

- `sysstat` 版本旧，没有 `%wait`；
- `stress -i` 依赖 `sync()`，缓存中无脏数据时不能制造有效 I/O；
- SSD 太快，`iowait` 不明显；
- 单核机器不会产生多核重调度 `RES`；
- `vmstat` 第一行是开机以来平均值，后续才是采样间隔平均值；
- 不同 sysbench 版本参数不同；
- Docker 版本过旧，没有新版 `--network` 参数。

处理规则：

1. 先检查工具、内核、容器运行时版本；
2. `man` 确认指标和首行语义；
3. 明确压测实际执行了什么系统调用；
4. 明确磁盘、CPU 数和设备名称；
5. 不追求截图一致，追求指标与机制一致。

