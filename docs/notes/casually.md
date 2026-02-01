---
title: 随手记
createTime: 2025/01/10 17:31:42
permalink: /notes/10fywd94/
---

::: timeline card line="dotted"

- 主机设置旁路代理
  time=2025-11-12 20:50

  任意 Linux 主机部署代理服务并设置为旁路。

  - **部署代理**
    
    ```yaml :no-line-numbers
    services:
      mihomo:
        image: metacubex/mihomo:latest
        container_name: mihomo
        network_mode: host
        restart: unless-stopped
        pid: host
        ipc: host
        cap_add:
          - ALL
        volumes:
          - ./mihomo:/root/.config/mihomo
          - /dev/net/tun:/dev/net/tun

      metacubexd:
        image: ghcr.io/metacubex/metacubexd:latest
        container_name: metacubexd
        ports: [9999:80]
        networks: [home]
        restart: unless-stopped

    networks:
      home:
        external: true
    ```

  - **主机设置**

    ```bash :no-line-numbers
    # 1. 开启 IP 转发
    sysctl -w net.ipv4.ip_forward=1
    sysctl -p

    # 2. NAT 伪装（让其他设备出网）
    iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
    iptables-save > /etc/iptables.rules
    ```

  之后将其他设备的网关和DNS指向此服务 ip 即可。
  
  **注意**：

  - 其他设备 DNS 必须指向本服务，是为了 fakeip 能正常工作；
  - 因为 linux 内核默认只发送本机流量，其他从其他设备进入的流量而目的地又不是本机的会被拒绝，开启IP转发是为了能让流量能正常被转发；
  - 默认情况下 linux 转发流量会带上源IP，这可能导致路由器直接响应给源IP，链路异常。开启 NAT 伪装时，linux 会做一层 NAT，将源IP改成本机IP；

- Linux 文件传输
  time=2025-11-06 16:59

  两台远程 Linux 主机间传输文件，假设发送端为(192.168.0.6)，接收端为(192.168.0.95)，在发送端执行(关闭加密和压缩)：

  ```bash :no-line-numbers
  # 如果 SSH 必须加密，可以选择轻量加密方式'Ciphers=aes128-gcm@openssh.com'，但依然不压缩
  rsync -ah --info=progress2 -e 'ssh -o Cipher=none -o Compression=no' /mnt/app/media/audiobooks/ root@192.168.0.95:/DATA/Media/audiobooks/

  # 也可以用pv(缺点是不知道整体大小，只能正向计算，即只能看到已传输的大小和花费时间，不能断点续传)
  # tar cf - /source/ | pv | tar xf - -C /target/

  # 本地拷贝(显示进度百分比和倒计时，可以断点续传)
  rsync -ah --info=progress2 /source/ /target/
  ```

  此方式可以传输文件和目录，并且可以显示进度，若传输的目录多整体内容也多还是建议打包传输。

  传统打包方式如:`tar -cvf audiobookshelf.tar audiobookshelf/`，缺点是不能显示打包进度。此时可以借助`pv`命令(安装`apt-get install pv`)，脚本如下：

  ```bash titile="tar_with_progress.sh" :collapsed-lines=5
  #!/bin/bash

  # 检查是否安装 pv
  if ! command -v pv &> /dev/null; then
      echo "❌ 错误: 未找到 'pv' 命令，请先安装 pv（例如：sudo apt install pv）"
      exit 1
  fi

  # 检查参数数量
  if [ $# -lt 1 ]; then
      echo "用法: $0 <源目录> [输出目录]"
      echo "示例: $0 ./audiobooks"
      echo "      $0 ./audiobooks /backup"
      exit 1
  fi

  SRC="$1"

  # 检查源目录是否存在
  if [ ! -d "$SRC" ]; then
      echo "❌ 错误: 源目录 '$SRC' 不存在或不是目录。"
      exit 1
  fi

  # 获取源目录的绝对路径（避免相对路径问题）
  SRC_ABS=$(realpath "$SRC")

  # 确定输出目录
  if [ $# -ge 2 ]; then
      OUT_DIR="$2"
  else
      # 默认为源目录的父目录（同级）
      OUT_DIR="$(dirname "$SRC_ABS")"
  fi

  # 检查输出目录是否存在，若不存在则尝试创建
  if [ ! -d "$OUT_DIR" ]; then
      echo "输出目录 '$OUT_DIR' 不存在，正在尝试创建..."
      mkdir -p "$OUT_DIR" || { echo "❌ 无法创建输出目录"; exit 1; }
  fi

  # 输出文件名 = 源目录 basename + .tar
  BASENAME=$(basename "$SRC_ABS")
  OUTPUT_FILE="$OUT_DIR/${BASENAME}.tar"

  # 获取总大小（字节）
  echo "正在计算目录大小..."
  SIZE=$(du -sb "$SRC_ABS" | awk '{print $1}')

  if [ -z "$SIZE" ] || [ "$SIZE" -eq 0 ]; then
      echo "⚠️  警告: 目录大小为 0，可能为空。"
      SIZE=1  # 避免除零或 pv 报错
  fi

  echo "📦 源目录: $SRC_ABS"
  echo "💾 输出到: $OUTPUT_FILE"
  echo "📊 总大小: $(numfmt --to=iec-i --suffix=B $SIZE 2>/dev/null || echo "${SIZE} 字节")"
  echo "⏳ 开始打包..."

  # 执行打包并显示进度
  tar -cf - -C "$(dirname "$SRC_ABS")" "$(basename "$SRC_ABS")" | pv -s "$SIZE" > "$OUTPUT_FILE"

  echo -e "\n✅ 打包完成：$OUTPUT_FILE"
  ```

  接着赋予执行权限:`chmod +x tar_with_progress.sh`，运行示例：

  ```bash :no-line-numbers
  # 示例1：只传源目录 → 输出到同级目录
  ./tar_with_progress.sh ./audiobooks

  # 示例2：指定输出目录
  ./tar_with_progress.sh ./audiobooks /mnt/backup
  ```

- 合并Git提交记录
  time=2025-09-02 11:06

  两种方式：

  - `git rebase -i`: 可以对历史提交 pick(保留提交)、squash(合并到上一条)、edit(修改提交内容)、reword(修改提交信息)。可以去掉某些提交记录，甚至修改提交顺序。
  - `git reset --soft`: 直接把 HEAD 重置到历史的一次提交，然后合并最近的所有提交。

  这两种方式都能实现合并提交的效果，但是方式一更灵活，它能实现的不仅是合并的效果；方式二更简单，通常来说只是想合并用这中方式更简单。

  方式一：

  ```bash :no-line-numbers
  # 启动 交互式 rebase，操作最近 5 条提交
  # HEAD~5 从 HEAD 记录起(不包含)，往前数 5 条。也可以直接写历史提交 hash，如：git rebase -i a1b2c3d
  # 保留最远的那条记录为 pick 不变，最近的几条都改为 squash
  git rebase -i HEAD~5
  # 查看提交历史信息
  git log --oneline
  # 编辑当前正在进行的 rebase 的 todo 列
  git rebase --edit-todo
  # 在 rebase 过程中，完成当前冲突或编辑后，继续执行剩余的 rebase
  git rebase --continue
  # 中止正在进行的 rebase，回到 rebase 开始前的状态。
  git rebase --abort
  # 强推
  git push origin main --force
  ```

  方式二：

  ```bash :no-line-numbers
  # 重置当前分支的 HEAD 指针到指定提交，同样可以指定提交 hash
  # 会把进 5 次的提交内容撤销，保留在暂存区
  git reset --soft HEAD~5
  # 提交暂存区所有内容
  git commit -m "把前5条提交合并成一条"
  # 查看效果
  git log --oneline
  ```

  reset 模式对比：

  |选项|暂存区|工作区|说明|
  |:--:|:--:|:--:|:--:|
  |--soft|保留|保留|只移动 HEAD，准备重新提交|
  |--mixed(默认)|清空|保留|重置暂存区，但保留工作区修改|
  |--hard|清空|清空|工作区和暂存区都恢复到指定提交状态，谨慎使用|

  这几种模式的常用场景：

  - soft(压缩提交): 合并提交历史、回滚但保留未提交的代码。不会动已提交/未提交的任何内容。
  - mixed(撤销提交): 取消误 add 的内容。清除历史提交，但保留为提交的内容。
  - hard(回退历史): 相当于一键还原，比如试验失败后想回到未试验之前。清除历史提交和本地未提交的内容。

- 一键进入BIOS
  time=2025-08-22 22:56

  使用方法：命令提示符(管理员身份运行)中输入`shutdown /r /fw /t 0`回车即可。  
  命令解释：`shutdown`表示关机，`/r`表示重启(reboot)，`/fw`表示固件(firmware)模式，`/t 0`表示超时(timeout)为0。  
  适用系统：Windows10/11。  
  报错解决：若执行命令后提示`操作系统找不到已输入的环境选项。(203)`，重复执行一次命令即可。

- 下载网站图标
  time=2025-08-18 13:51

  获取网站图标的 3 种方式(以 https://google.com 为例)：
  - https://www.google.com/favicon.ico
  - https://www.google.com/s2/favicons?sz=64&domain=google.com
  - https://favicon.im/zh/google.com?larger=true

- GitHub Sync Fork 私有仓库
  time=2025-08-14 18:05

  当我们在 GitHub Fork 了一个仓库后，如果仓库设置为公开，则可以方便的在页面上点击`Sync Fork`来同步上游更新，但如果仓库设置为私有，则会断开与上游的关联，此时如果需要同步上游就需要手动建立关联。一键同步脚本示例：

  ```bash :no-line-numbers
  #!/bin/bash
  # sync-fork.sh - 使用 rebase 同步私有 fork（保留自己的提交）

  set -e  # 一旦出错就退出

  BRANCH="main"  # 要同步的分支

  # 检查是否配置了 upstream
  if ! git remote | grep -q upstream; then
      git remote add upstream git@github.com:shenweiyan/WebStack-Hugo.git
  fi

  echo ">>> 获取上游更新"
  git fetch upstream

  echo ">>> 切换到 $BRANCH 分支"
  git checkout "$BRANCH"

  echo ">>> 开始 rebase 到 upstream/$BRANCH"
  if ! git rebase "upstream/$BRANCH"; then
      echo "⚠️  rebase 过程中出现冲突，请手动解决冲突："
      echo "    1. 解决冲突后运行： git add ."
      echo "    2. 继续 rebase：   git rebase --continue"
      echo "    3. 完成后推送：   git push origin $BRANCH"
      exit 1
  fi

  echo ">>> 推送到 origin/$BRANCH（强制更新以保持线性历史）"
  git push origin "$BRANCH" --force-with-lease

  echo "✅ 同步完成（使用 rebase 保持线性历史）"
  ```

- 推送本地 Git 仓到远程
  time=2025-06-24 12:37

  先在远程创建一个仓库，然后复制地址，如：`ssh://gogs.mc.lan/mayee/example.git`。  
  接着在本地执行如下命令：

  ```bash :no-line-numbers
  # 可以是 ssh 或 https 协议的地址
  git remote add origin ssh://gogs.mc.lan/mayee/example.git
  # main 表示远程分支名
  git push -u origin main
  ```

- vscode 生成 Java 类序列化版本号
  time=2025-06-18 05:20

  首先要确保已经安装了插件`Language Support for Java(TM) by Red Hat`，然后在工程根目录下创建两个文件`org.eclipse.jdt.core.prefs`、`settings.json`，目录结构如下：

  ```plain :no-line-numbers
  project-name
  ├── .settings
  │   └── org.eclipse.jdt.core.prefs
  ├── .vscode
  │   └── settings.json
  ├── src // 项目源代码
  │   └── ...
  └── pom.xml
  ```

  文件内容分别如下：

  ```text title="org.eclipse.jdt.core.prefs" :no-line-numbers
  org.eclipse.jdt.core.compiler.problem.missingSerialVersion=warning
  ```

  ```json title="settings.json" :no-line-numbers
  {
     "java.settings.url": ".settings/org.eclipse.jdt.core.prefs"
  }
  ```

  之后就可以像 IDEA 那样在实现了`Serializable`接口但又没有`serialVersionUID`的类就会显示警告，点击类名就可以自动生成版本号。

- vscode 安装 go tools
  time=2025-06-15 05:47

  go tools 是 go 语言提供的一些工具，首先安装 Go 插件，使 vscode 能支持 go 语言。接着在 IDE 的顶部点击`查看`->`命令面板`或者输入`ctrl+shift+p/a`也能打开命令面板，输入`Go:Install/Update Tools`，然后选择所有选项，就会自动安装 go tools，等待安装完成即可，工具被安装在`$GOBIN`目录。

  总共 7 个工具：

  - gopls: Go 语言服务器，智能补全/跳转等
  - dlv: Delve，Go 调试工具
  - goimports: 自动格式化并添加/移除 import
  - goreturns: 类似 goimports，可自动生成 return
  - staticcheck: 静态代码分析工具
  - go-outline: 支持代码大纲视图

- 虚拟机磁盘/Ubuntu分区扩容
  time=2025-06-14 23:47
  
  使用 VMware 虚拟机，安装了 Ubuntu 系统，可能发现刚开始分配的磁盘不足(仅20G)，此时就需要扩容(到30G)。

  - **扩容磁盘**

    1.关闭虚拟机。

    2.编辑虚拟机，扩展磁盘容量，然后启动虚拟系统。

    3.进系统后输入`lsblk`，查看磁盘分区情况。

    ```bash :no-line-numbers
    NAME                      MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
    sda                         8:0    0   30G  0 disk
    ├─sda1                      8:1    0    1M  0 part
    ├─sda2                      8:2    0  1.8G  0 part /boot
    └─sda3                      8:3    0  8.2G  0 part
      └─ubuntu--vg-ubuntu--lv 252:0    0  8.2G  0 lvm  /
    ```

    可以看到虚拟机磁盘`sda`总共有 30G，分为三个分区`sda1`、`sda2`、`sda3`，但这三个分区加起来也只有10G(1M+1.8G+8.2G)，说明原本的 20G 磁盘中有 10G 是没分配的，并且增加的 10G 磁盘也还没有分区。

    4.`sudo fdisk -l /dev/sda`查看未分配空间。

    5.安装分区工具(若未安装)`sudo apt update && sudo apt install cloud-guest-utils -y`。

    6.`sudo growpart /dev/sda 3`这会把`sda3`分区结尾扩展到磁盘最大容量。此时使用`lsblk`查看:

    ```bash :no-line-numbers
    NAME                      MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
    sda                         8:0    0   30G  0 disk
    ├─sda1                      8:1    0    1M  0 part
    ├─sda2                      8:2    0  1.8G  0 part /boot
    └─sda3                      8:3    0 28.2G  0 part
      └─ubuntu--vg-ubuntu--lv 252:0    0  8.2G  0 lvm  /
    ```

    可以看到`sda3`分区扩大到整个磁盘了，但是根分区`ubuntu--vg-ubuntu--lv`仍然没变。

  - **扩容根分区**

  1.`sudo pvresize /dev/sda3`扩展 LVM 物理卷。

  2.`sudo lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv`扩展逻辑卷(根分区 /)。

  3.`sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv`扩展文件系统(ext4格式用，ubuntu系统通常是这个)，如果是 xfs 格式用`sudo xfs_growfs /`，这让系统能使用新空间。此时使用`lsblk`查看:

  ```bash :no-line-numbers
    NAME                      MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
    sda                         8:0    0   30G  0 disk
    ├─sda1                      8:1    0    1M  0 part
    ├─sda2                      8:2    0  1.8G  0 part /boot
    └─sda3                      8:3    0 28.2G  0 part
      └─ubuntu--vg-ubuntu--lv 252:0    0 28.2G  0 lvm  /
    ```

    可以看到根分区`ubuntu--vg-ubuntu--lv`已经使用 sda3 分区整个空间了。

- Git 配置仓库用户名和邮箱
  time=2025-06-14 20:32

  为某个仓库设置单独的用户名和邮箱，需要在仓库根目录执行以下命令：

  ```bash :no-line-numbers
  git config user.name "YourName"
  git config user.email "you@example.com"
  ```

  查看配置`git config --local --list`，或者只查看邮箱`git config user.email`。这个设置被保存在`<本地仓库路径>/.git/config`文件中。

- OpenWrt UCI 配置操作函数
  time=2025-06-06 04:41

  在`/etc/init.d/*`下的脚本中如果想使用配置如何做呢？这就需要 UCI 配置操作的几个函数`config_load`、`config_foreach`、`config_get`，见名知其意，大概知道函数的意思，但如何使用需要详细了解下。

  例如脚本中存在这么一段：

  ```bash :no-line-numbers
    start_instance () {
      local section="$1"
      config_get path "$section" 'path'
      config_get port "$section" 'port'
      service_start /usr/bin/svnserve -d --listen-port ${port} -r ${path}
    }

    start() {
      config_load 'subversion'
      config_foreach start_instance 'subversion'
    }
  ```

  - **config_load**: 读取`/etc/config/*`下指定名称的文件，如`config_load 'subversion'`即是读取`/etc/config/subversion`文件，文件内容示例：
  
    ```ini title="subversion" :no-line-numbers
      config svn
          option path     '/srv/svn/repos'
          option port     '3690'

      config pdd svn1
          option path     '/srv/svn/repos/clash-meta'
    ```

    其中每一段表示为一个`section`，上述配置有 2 个 section；而`svn`和`pdd`表示`section_type`，section_type 后面是`section_name`它必须是唯一值，如果没有指定 section_name 则表示为匿名 section，会自动分配一个唯一 id 作为它的 name。

  - **config_foreach**: 语法为`config_foreach <function> <section_type>`，遍历指定类型的 section，对每个 section 执行指定的函数。例如：
  
    ```bash :no-line-numbers
    # 遍历所有 section_type 为 svn 的 section，则 pdd 的 section 就不会被遍历
    config_foreach start_instance 'svn'
    ```

  - **config_get**: 使用语法为`config_get <var> <section_name> <option> [<default>]`，`var`是将读取的值用一个变量存储，`section_name`是指定的段名，`option`是 section 下的 option 名称，`default` 是当 option 不存在时的默认值。例如：
  
    ```bash :no-line-numbers
      # 加载配置文件
      config_load 'subversion'
      # 读取名称为 svn1 的 section 下，option 为 port 的值，如果没有则默认为 8080，并将值存储在变量 p1 中
      config_get p1 svn1 'port' 8080
      config_foreach start_instance 'svn'
      # 这是提前定义的一个函数
      start_instance () {
        # 系统会自动把 section_name 作为第一个参数传入。但这里 section_type 为 svn 的 section 是一个匿名的段，则分配的随机 id 可能为 cfg0a1b23
        local section="$1" # cfg0a1b23
        config_get path "$section" 'path'
      }
    ```

- Windwos 安装 SVN 客户端
  time=2025-06-05 17:35

  可以上[Apache Subversion](https://subversion.apache.org/packages.html)下载二进制包，亦或者上[TortoiseSVN(推荐)](https://tortoisesvn.net/downloads.zh.html)下载，Windows 上最常用的就是这个了。  
  在安装`TortoiseSVN`的过程中要注意一点，`Command Line Tools`默认不会安装，但需要勾选安装，这样在安装完成后会在`C:\Program Files\TortoiseSVN\bin`目录下出现`svn.exe`，然后就可以在其他代码编辑器中配置 SVN 插件了。

- 编辑远程 Linux 文件
  time=2025-06-05 16:47

  由于经常需要编辑 OpenWrt 系统上的文件，终端上编辑器不好用，下载编辑后再上传又麻烦。如果有一款工具可以连接远程主机，然后像 Windows 文件管理器那样可视化查看，双击编辑，保存就生效，那就需要[WinSCP](https://winscp.net/eng/download.php)。  
  使用很简单，点击`新建站点`，`文件协议`选择`SCP`，输入`主机名`、`用户名`、`密码`，端口默认`22`，然后连接即可。可以在`选项`->`编辑器`中配置外部编辑器为 VSCode。

- Windows11 设置加密 DNS
  time=2025-06-04 06:36

  由于家里有 IPv6 的动态公网，做了 DDNS 解析，一开始好好的，一段时间后突然就发现连接不通了。首先检查域名托管商那的记录，发现记录的 IPv6 是最新地址，没毛病。然后通过`ping <子域名>`发现返回的 IPv6 地址是旧的，这自然就不会通。但是用`nslookup <子域名>`发现返回的 IPv6 地址是最新的，那么访问应该是没问题的。可我这是家宽啊，又不过 GFW，不应该是域名被墙了。由于我把主域名和泛域名解析的是同一地址，于是试了下`ping <主域名>`发现返回的是最新的地址，再`ping <子域名>`呢？仍然返回旧地址，说明运营商的 DNS 服务器没问题，就是单纯的把我子域名通过 DNS 污染了，解决方法到也简单，设置加密 DNS 即可。
  
  打开`设置`->`网络和 Internet`，选择`已连接`的网络->`属性`，在`DNS 服务器分配`一栏点`编辑`。
  
  默认是`自动(DHCP)`意思就是说自动给的 DNS 服务器地址是 DHCP 服务器的地址，那么 DHCP 服务器是谁呢？简单来说就是谁分配 IP 谁就是 DHCP，对局域网来说这个 DHCP 就是路由器，但是路由器可以帮你做内网的地址交换，你如果请求的是一个互联网地址，它就只能把这个地址继续向上级请求，这里上级就是运营商的 DNS 服务器了，所以运营商就会在这个环节使坏，给一个错误的 IP 地址导致通过域名请求不通。
  
  所以我们得改成`手动`，因为我的域名只做了 IPv6 的地址解析，理论上来说改一下 IPv6 的 DNS 地址就可以了，不过为了隐私安全，最好还是连 IPv4 也设置下。
  
  **IPv4**：

  |首/备选 DNS|DNS over HTTPS|DNS over HTTPS 模板|说明|
  |:--:|:--:|:--:|:--:|
  |223.5.5.5|开(手动模板)|https://dns.alidns.com/dns-query|阿里公共加密DNS|
  |119.29.29.29|开(手动模板)|https://doh.pub/dns-query|腾讯公共加密DNS|

  **IPv6**：

  |首/备选 DNS|DNS over HTTPS|DNS over HTTPS 模板|说明|
  |:--:|:--:|:--:|:--:|
  |2400:3200::1|开(手动模板)|https://dns.alidns.com/dns-query|阿里公共加密DNS|
  |2402:4e00::|开(手动模板)|https://doh.pub/dns-query|DNSPod加密DNS(腾讯系的)|

  注意，`2402:4e00::`这个并没有写错，看起来像是不完整，因为 DNSPod 它又很多 DNS 地址，这里写的是一个范围。
  
  经过上述设置后，再`ping <子域名>`已经可以返回最新的 IP 了，但整体速度很慢，大约 3~5 秒才响应，这个其实是运营商对我的 IPv6 访问限速了。不过对我来说问题不大，只要能通就行，毕竟这是一个非常低频的动作。  
  我的回家方式是，通过域名(IPv6)访问到家里路由器 WAN 网卡的固定端口，在这个端口上有一个反代服务指向了内网的一个 HTTP 服务，然后通过 HTTP 返回就能获取到 IPv4 的回家节点，之后全程用 IPv4 就可以满速回家了。

- Windows11 设置局域网代理
  time=2025-06-04 06:32

  按`Win + R`打开运行，然后输入`inetcpl.cpl`在打开的面板中选择`连接`->`局域网设置`，在`代理服务器`下手动设置地址和端口。

- Windows11 管理软件开机启动
  time=2025-06-04 01:19

  一部分软件安装后可能会默认开机启动，但我并不需要，这反而增加了开机耗时。一般软件设置中都有自启开关，但也有没有这个开关的软件，例如`Tailscale`。  
  我们可以按`Ctrl + Shift + ESC`打开任务管理器，在`启动`(Win10)或`启动应用`(Win11)一栏中可以看到软件的状态，`已启用`表示已开机自自启、`已禁用`表示已禁止开机自启。鼠标右键单击相应的软件即可`启用`/`禁用`。

- ThinkPad 安装 Win7 系统
  time=2025-06-04 01:03

  这个 ThinkPad E545 edge 购于 2013年左右，算是古董级电脑了。搭载 APU A8-5550M 性能中下，英雄联盟都玩不了，很拉跨。但硬件又还是好的，浏览网页还是没问题的。于是选择[Win7 企业版 SP1](https://msdn.itellyou.cn/)，一定要带 SP1 否则有些软件可能安装不了。目前很多软件已经不支持这么老的系统了，但是没办法，古董级运行Win10太吃力了。  
  写盘工具可以选择[rufus-3.22](https://github.com/pbatard/rufus/releases/download/v3.22/rufus-3.22.exe)最后一个支持 Win7 的版本，或者[微PE工具箱V1.3](https://mirrors.sdu.edu.cn/wepe/WePE_64_V1.3.exe)(推荐)。  
  开机按`F1`进入 BIOS，系统安装完成后会发现没有任何驱动，无法联网(有线/无线)，无法识别U盘，这就蛋疼了。不过随后发现 USB3.0 需要驱动，但 USB2.0 不需要驱动，此时可以下载[360驱动大师网卡版](https://dl.360safe.com/drvmgr/360DrvMgrInstaller_net.exe)，然后插 USB3.0 接口安装，如果不行可以进入到 PE 系统，然后安装。

- 小米本安装 Win10 系统
  time=2025-05-29 11:23

  这个小米购于 2019-11-11，比较老的电脑了，系统卡顿。网上找各种精简版系统体验都不好，打算下载 LTSC 版本(企业长期支持版)。此版本主打稳定少变动，相比家庭版本来就会精简一些。考虑到我这小米本发售的时间段，设备配套的系统往往都是出厂版本是最流畅的，于是下载[Windwos10 2019 LTSC](https://msdn.itellyou.cn/)。

  当前有两块硬盘(0: 因特尔；1: 三星)，三星是自带的，因特尔是加装的。Windows 系统安装到三星硬盘，因为英特尔硬盘还能安装黑苹果，但三星硬盘不能。  
  下载[Rufu 标准版](https://rufus.ie/zh/)将系统写入 U 盘，然后电脑开机按`F2`进入 BIOS 设置 U 盘启动，保存后再开机即可进入 U 盘开始刷机。  
  重新进入系统后，[激活系统](/notes/q5w629t0/)，然后`win+r`输入`sysdm.cpl`回车打开窗口，在上方 tab 栏中选择`高级`->`设置`，然后更改选项`调整为最佳性能`，这样会停用系统在的一些动态效果，使用更流畅且省电。

- 为仓库单独设置 Git 提交邮箱
  time=2025-01-27 16:36

  在工程的`.git`目录下找到`config`文件，在其中添加，如：

  ```text:no-line-numbers
  [user]
    name = Bobby
    email = bobby@qq.com
  ```

- Docker Desktop 设置仓库镜像
  time=2024-04-28 22:43

  ```text:no-line-numbers
  // Docker中国区官方镜像
  https://registry.docker-cn.com
  // 中科大
  //https://docker.mirrors.ustc.edu.cn/
  // 网易
  https://hub-mirror.c.163.com/
  // 腾讯
  https://mirror.ccs.tencentyun.com
  ```

  打开Docker Desktop设置 > Docker Engine

  默认情况下配置如下：

  ```json:no-line-numbers
  {
    "builder": {
      "gc": {
        "defaultKeepStorage": "20GB",
        "enabled": true
      }
    },
    "experimental": false
  }
  ```

  新增配置后如下：

  ```json:no-line-numbers
  {
    "builder": {
      "gc": {
        "defaultKeepStorage": "20GB",
        "enabled": true
      }
    },
    "experimental": false,
    "registry-mirrors": [
      "https://registry.docker-cn.com",
      "https://docker.mirrors.ustc.edu.cn",
      "https://hub-mirror.c.163.com"
    ]
  }
  ```

  使用`docker info`命令可以查看 Docker 配置。

- Windows 找到所有应用
  time=2024-04-28 15:15

  打开`文件资源管理器`(Win + E)，然后在地址栏中输入`shell:AppsFolder`，然后按回车键。

- Windows 添加小鹤双拼
  time=2023-03-24 00:15

  新建文本文件，将以下命令粘贴到文本中保存，文件后缀修改为`.reg`，然后双击执行。
  注意，文本默认是以`UTF-8` 编码保存，在 Windows 系统中文会乱码，需要将文本编码修改为`GBK`才能正常显示。

  添加小鹤双拼：

  ```txt:no-line-numbers
  Windows Registry Editor Version 5.00

  [HKEY_CURRENT_USER\SOFTWARE\Microsoft\InputMethod\Settings\CHS]
  "EnableExtraDomainType"=dword:00000001
  "Enable Double Pinyin"=dword:00000001
  "DoublePinyinScheme"=dword:0000000a
  "UserDefinedDoublePinyinScheme0"="小鹤双拼*2*^*iuvdjhcwfg^xmlnpbksqszxkrltvyovt"
  ```

  关闭小鹤双拼：

  ```txt:no-line-numbers
  Windows Registry Editor Version 5.00

  [HKEY_CURRENT_USER\SOFTWARE\Microsoft\InputMethod\Settings\CHS]
  "EnableExtraDomainType"=dword:00000000
  "Enable Double Pinyin"=dword:00000000
  "DoublePinyinScheme"=dword:00000000
  "UserDefinedDoublePinyinScheme0"=-
  ```

- Windows 去除快捷方式小箭头
  time=2023-03-18 21:21

  新建文本文件，将以下命令粘贴到文本中保存，文件后缀修改为`.bat`，然后以管理员权限运行。

  去除小箭头：

  ```bat:no-line-numbers
  reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Icons" /v 29 /d "%systemroot%\system32\imageres.dll,197" /t reg_sz /f
  taskkill /f /im explorer.exe
  attrib -s -r -h "%userprofile%\AppData\Local\iconcache.db"
  del "%userprofile%\AppData\Local\iconcache.db" /f /q
  start explorer
  pause
  ```

  恢复小箭头：

  ```bat:no-line-numbers
  reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Icons" /v 29 /f
  taskkill /f /im explorer.exe
  attrib -s -r -h "%userprofile%\AppData\Local\iconcache.db"
  del "%userprofile%\AppData\Local\iconcache.db" /f /q
  start explorer
  pause
  ```

- Git 暂存代码
  time=2022-12-20 23:07
  
  当我们在某一个分支进行开发时，突然要修一个紧急故障，就需要切换到其他分支，如果直接切到另一个分支，就需要提交当前分支代码，可是半成品代码提交上去也不合适。
  此时就需要将代码压入暂存区，然后就可以切换到其他分支，待修复完后再切回来，将暂存区的代码弹出。

  ```shell:no-line-numbers
  # 压入暂存区
  git stash
  # 弹出暂存区
  git stash pop
  ```

- fastjson 转换 double变 decimal
  time=2022-12-20 22:55

  fastjson 避免实体转 json 对象时，double 类型变成 decimal 类型

  ```java:no-line-numbers
  public JSONObject toUnderlineObj(Object object) {
      int disableDecimalFeature = JSON.DEFAULT_PARSER_FEATURE & ~Feature.UseBigDecimal.getMask();
      return JSON.parseObject(toUnderlineStr(object), JSONObject.class, disableDecimalFeature, Feature.OrderedField);
  }
  ```

- RabbitMQ 消费者单活
  time=2022-12-20 22:49

  当启动了多个消费者实例时，如果只允许其中一个进行消费，需要在创建 queue 时需指定参数。
  `Activity status`处于`single active`的实例可以消费，其他实例为`waiting`状态，只能在`single active`实例停止消费后，才会有一个可以消费。

  ```java:no-line-numbers
  Map<String, Object> args = new HashMap<>();
  args.put("x-single-active-consumer", true);
  channel.queueDeclare(name, isDurable, false, false, args);
  ```

- Go 判断 struct 是否实现接口
  time=2022-12-17 18:06

  ```go:no-line-numbers
  var _ Animal = (*Dog)(nil)
  var _ Animal = new(Dog)
  ```

- Elasticsearch 批量操作
  time=2022-12-17 18:03

  我们在进行 es 批量写时，通常会用到 bulk api，它的 operateType 支持 4 种：

  - create：如果文档不存在就创建，但如果文档存在就返回错误；
  - index：如果文档不存在就创建，如果文档存在就更新；
  - update：更新一个文档，如果文档不存在就返回错误；
  - delete：删除一个文档，如果要删除的文档id不存在，就返回错误；

  需要注意的是，index 操作可以实现 upsert 效果，但是它的更新方式是，先删除原文档，然后再插入文档。如果我们只想更新给定的字段，而已存在文档其他未指定字段不动，就需要用到如下方式：

  ```java:no-line-numbers
      @Test
      void testEsAdd() {
          JSONObject body = new JSONObject();
          body.put("name","Regan");
          body.put("age",20);
          JSONObject source = new JSONObject();
          source.put("doc",body);
          source.put("upsert",body);
          QueryRequest request = new QueryRequest(HttpMethod.POST.name(), "index_bobby/test/1/_update");
          request.setJsonEntity(JSON.toJSONString(source, SerializerFeature.DisableCircularReferenceDetect));
          es.bulk(Collections.singletonList(request));
      }
  ```

  bulk 的 operateType 使用 update。

- Goland 中使用 go 工具命令
  time=2022-12-17 17:18

  在使用 Goland(IDEA 安装 Go 插件也可)时，我们创建一个`运行/调试配置`，选择`Go构建`面板，其中有`Go 工具实参`和`程序实参`两项。
  当我们在程序中使用 flag 接收启动指令的参数，应该写在`程序实参`栏中，例如：`--debug`、`--env=dev`。
  当我们需要从外部替换源文件中的变量值，使用的是 go build -ldflags 参数名，则应在`Go 工具实参`
  栏中填写，例如：`-ldflags "-X 'core.Version=1.1.1'"`。
  当我们需要条件编译时，使用的是 go build -tags 参数名，则应在`Go 工具实参`栏中填写，例如：`-tags pro`
  。前提是源文件中第一行有`//go:build pro`或`+build pro`。
  `//go:build`与`+build`的区别：`//go:build`写法是 Go 1.17 引入的，旨在替换`+build`写法。为什么要采用新写法呢，看如下两个示例：

  - `//go:build linux && amd64 || darwin`
  - `+build linux,amd64 darwin`

  这两种实现效果等价。显而易见的是，`go:build`这种写法对开发来说更直观，同时也与`//go:embed`和`//go:generate`命令，格式上进行了统一。
  很多时候我们会看到一个文件顶部，同时有这两种写法，主要是为了兼容 Go 1.17 以下的版本。

- Linux 环境变量设置
  time=2022-09-12 14:23

  - 系统级：`/etc/profile`、`/etc/bashrc（Ubuntu和Debian中是/etc/bash.bashrc）`、`/etc/environment`
  - 用户级：`~/.profile（推荐首选）`、`~/.bashrc`

  系统级的环境变量在每个用户登录时都会加载，用户级的环境变量只有在当前用户登录时加载。开发环境建议配置为用户级环境变量。
  在 JDK 官网下载的 .deb 文件，安装是在`/usr/lib/jvm/`目录下。
  `/lib`是内核级目录，`/usr/lib`是系统级目录，`/usr/local/lib`是用户级目录。安装 Go、Node、Maven 等开发环境时，可以将压缩包解压至`/usr/local/lib`目录中，然后在`~/.profile`文件中配置用户环境变量。
  进行设置后，可运用`source ~/.bashrc`命令更新`.bashrc`，也可运用`source ~/.profile`命令更新`.profile`
  参考：[linux中环境变量在哪个文件](https://www.php.cn/linux-492794.html)、[bashrc与profile的区别](https://blog.csdn.net/heybeaman/article/details/87289405)

- Webstorm 终端运行 hexo 服务
  time=2022-09-03 19:45

  ```shell:no-line-numbers
  npx hexo clean `&` hexo server
  ```

  腾讯云 cloudBase 中的构建命令

  ```shell:no-line-numbers
  npx hexo clean & npx hexo generate
  ```

- Windows11 开启 SMB
  time=2022-09-03 17:24

  `win+x`打开`运行`，然后输入`shrpubw`，根据提示创建共享目录。  
  安卓端使用`Oplayer`播放器，IOS端使用`nplayer`播放器比较方便使用，如果要输入密码，则是 windows 的登录账号、密码。

- 解决 coding 不能拉代码
  time=2022-09-02 22:53

  [coding 配置 ssh 秘钥](https://help.coding.net/docs/repo/ssh/config.html)，配置个人公钥是可以对账号所有的代码仓库进行读写。团队公钥默认只读，可以设置读写。但根据官网提示，配置完秘钥后，执行`ssh -T git@e.coding.net`还是提示没有权限。  
  解决方法：找到 git 的安装目录`C:\Config\Git\etc\ssh`下的`ssh_config`文件，用记事本打开，在末尾处添加：

  ```bash:no-line-numbers
  # Added by git-extra
  Host *.coding.net
    HostkeyAlgorithms +ssh-rsa
    PubkeyAcceptedAlgorithms +ssh-rsa
  ```

  保存关闭即可，再次输入：`ssh -T git@e.coding.net`，然后即可拉取代码。

- Git 优雅合并分支
  time=2022-07-05 16:55

  当存在多个分支需要合并时，例如，`master`(主干分支)，`dev`(开发分支)，直接使用`merge`会导致主分支混乱，看起来不是一条直线，解决方式是使用`rebase`，具体操作：

  ```bash:no-line-numbers
  checkout dev
  rebase dev onto master
  checkout master
  merge dev into master
  ```

- Deepin 创建桌面图标和启动器图标
  time=2022-05-21 23:30

  - 创建桌面图标
  
    当我们用压缩包解压安装某个应用软件的时候，例如 IDEA，解压完成后，在桌面上创建一个文件例如`IDEA-2022.1.desktop`，后缀为`.desktop`，但可以用文本编辑器打开，打开后在编辑内容如下:

    ```text:no-line-numbers
    [Desktop Entry]
    Categories=Application;Development;
    Comment=IntelliJ IDEA Ultimate 2022.1
    Encoding=UTF-8
    Exec=/opt/apps/idea-IU-221.5080.210/bin/idea.sh
    Icon=/opt/apps/idea-IU-221.5080.210/bin/idea.png
    Name=IDEA-2022.1
    StartupNotify=true
    Terminal=false
    Type=Application
    X-Deepin-Vendor=user-custom
    ```

  其中`Comment`和`Name`自定义名字，`Exec`和`Icon`选择为实际路径，其余保持默认。

  - 创建启动器图标

    ```bash:no-line-numbers
    sudo cp IDEA-2022.1.desktop /usr/share/applications/
    ```

- Deepin 卸载自带的 OpenJDK
  time=2022-05-12 21:44

  ```bash:no-line-numbers
  dpkg -l | grep openjdk # 查看openJDK的安装列表
  ```

  ```bash:no-line-numbers
  sudo apt-get remove openjdk* # 卸载
  ```

- Linux 下安装 Go 开发环境
  time=2022-05-11 12:13

  从官网下载 tar.gz 压缩包，`sudo tar -xvf 文件.tar.gz -C /user/local`，然后在`/usr/local`下会有一个`go`的目录。  
  官网推荐解压放在`usr/local`目录下，而macos下安装也是会自动放在此目录下。然后在用户目录下创建一个`go`目录，用来当作gopath路径。

- 解决 .gitignore 文件无法忽略
  time=2022-05-06 11:23

  **方法一**：清除 Git 本地缓存，使其改变成未 track 状态，然后再提交(使用时最好所有文件已经完全 push 了)：

  ```bash:no-line-numbers
  git rm -r --cached .
  git add .
  git commit -m 'update .gitignore'
  git push -u origin main # 提交到 main 分支
  ```

  **方法二(推荐)**：在每个clone下来的仓库中手动设置不要检查特定文件的更改情况。

  ```bash:no-line-numbers
  git update-index --assume-unchanged PATH # 在PATH处输入要忽略的文件
  ```

  **原因**：`.gitignore`只能忽略那些原来没有被`track`的文件，如果某些文件已经被纳入了版本管理中，则修改`.gitignore`是无效的。想要`.gitignore`起作用，这些文件必须不在暂存区中才可以，`.gitignore`文件只是忽略没有被`taged(cached)`文件。对于已经被`staged`文件，加入`.ignore`文件时一定要先从`staged`移除，才可以忽略。
  
  **特别注意**：若在使用`.gitignore`文件之前，这个要忽略的文件已经被推送到了远程仓，如何删除远程仓的而保留本地的？  
  此时不可直接使用`git rm directory`，因为这样会删除本地仓的文件。可以使用`git rm -r --cached directory`来删除缓冲，然后再`commit`和`push`，这样会发现那个要删除的目录或文件，在远程仓中就没有了，之后可以直接使用`git add -A`来添加修改的内容，上传的文件就会受到`.gitignore`文件的内容约束。
  
  **额外说明**：Git 管理的目录中，文件大致有 4 种状态：  
  - Untracked：未跟踪, 此文件在文件夹中, 但并没有加入到 Git 仓库, 不参与版本控制。通过`git add`使状态变为`staged`。  
  - Unmodify：文件已经入库, 未修改, 即版本库中的文件快照内容与文件夹中完全一致。这种类型的文件有两种去处，如果它被修改，而变为`Modified`；如果使用`git rm`移出版本库，则成为`Untracked`文件。
  - Modified：文件已修改，仅仅是修改，并没有进行其他的操作。这个文件也有两个去处，通过`git add`可进入`staged`暂存状态；如果使用`git checkout`则丢弃修改，返回到`unmodify`状态，这个`git checkout`即从库中取出文件，覆盖当前修改。
  - Staged：暂存状态。执行`git commit`则将修改同步到库中，这时库中的文件和本地文件又变为一致，文件为`Unmodify`状态。执行`git reset HEAD <filename>`取消暂存，文件状态为`Modified`。

  Git 状态`untracked`和`not staged`的区别：
  - `untrack`表示是新文件，没有被`git add`过，是未跟踪的意思
  - `not staged`表示`git add`过的文件，即跟踪文件，再次修改后没有再`git add`，就是没有暂存的意思

- Windows 下使用 make 和 gcc 命令
  time=2022-05-05 15:27

  **方法一**：参考`fyne(一款 go 的 gui 框架，其编译需要使用 gcc 命令)`中提及的方式，安装 [MSYS2](https://developer.fyne.io/started/)。安装完成后将`C:\Application\msys64\mingw64\bin\mingw32-make.exe` 在当前目录复制一份并重命名为`make.exe`，然后将此目录添加到环境变量`path`中，重启生效。

  **方法二**：参考[windows10配置make命令](https://blog.51cto.com/u_15262460/2882762)，安装`MinGW`。安装完成后将`C:\Application\MinGW\bin\mingw32-make.exe`在当前目录复制一份并重命名为`make.exe`，然后将此目录添加到环境变量`path`中，重启生效。

  查看命令是否安装成功：

  ```bash:no-line-numbers
  make -v
  ```

  在上述完成后，就可以使用`make`命令执行 Makefile 文件，但若 Makefile 文件中定义了有 shell 语句则依旧不能正确执行。解决方式是使用`Git`，打开 IDEA 设置，在`Tools Terminal`中将`Shell Path`修改为`C:\Config\Git\bin\bash.exe`，即可在 Git Bash 中执行 shell 命令。

  Windows 下的 cmd 神器 - [cmder](https://cmder.net/)，也可以模拟 Linux 环境，具体使用方式自行再探索。

- Git 配置全局用户名和邮箱
  time=2022-05-04 15:51

  ```bash:no-line-numbers
  git config --global user.name "mayee"
  git config --global user.email "maye_e@qq.com"
  ```

  查看全局配置：

  ```bash:no-line-numbers
  git config --global --list
  ```

  显示：

  ```bash:no-line-numbers
  user.name=mayee
  user.email=maye_e@qq.com
  ```

  生成 ssh 密钥：

  ```bash:no-line-numbers
  ssh-keygen -t ed25519 -C "deepmi" # 使用 ed25519 算法生成秘钥
  ```

  连续三次按回车，提示密钥被存储在`/Users/用户目录/.ssh/id_ed25519.pub`中，然后用`cat`命令查看密钥。
  
  若需要使用多个 SSH 密钥对，在`Enter file in which to save the key`步骤时，输入一个新的文件名称就可以避免覆盖已有的密钥对。
  
  `deepmi`是生成的 sshkey 的名称，并不约束或要求具体命名为某个邮箱。现网的大部分教程均讲解的使用邮箱生成，其一开始的初衷仅仅是为了便于辨识所以使用了邮箱。

  创建密钥前先确认是否对目录有读写权限：

  ```bash:no-line-numbers
  icacls "C:\Users\maye\.ssh\github\Ma-yeah"
  ```

  需要确认只有自己有访问权限，如果其他用户也有访问权限，需要重置：

  ```bash:no-line-numbers
  icacls "C:\Users\maye\.ssh\github\Ma-yeah" /reset
  ```

  默认情况下，密钥会生成在`C:\Users\maye\.ssh\`目录下，但是我们可能会在`GitHub`、`Gitee`、`GitLab`等多个平台有多个账号。默认生成秘钥时，如果不指定保存路径，那么就会覆盖之前的密钥。  
  例如，当我在我的微星电脑`micro-star`上想为我的 GitHub 账号`Ma-yeah`生成一个 SSH 密钥，可以按如下步骤操作：

  - 在`C:\Users\maye\.ssh\`目录下手动创建目录，最终目录结构为`C:\Users\maye\.ssh\github\Ma-yeah`；
  - 打开`Git Bash`输入`ssh-keygen -t rsa -C "micro-star"`；
  - 按一次回车后，会询问你秘钥保存的位置，默认为`/c/Users/maye/.ssh/id_rsa`，此时修改为`/c/Users/maye/.ssh/github/Ma-yeah/id_rsa`；
  - 然后连续回车即可；

  创建完密钥后还需要设置，编辑`C:\Users\maye\.ssh\`目录下的`config`文件(注意文件没有后缀，如果文件不存在则创建)，添加如下内容：

  ```text:no-line-numbers
  # GitHub
  Host github.com
    IdentityFile C:\Users\maye\.ssh\Github\Ma-yeah\id_ed25519
    User git
  # GitLab
  Host gitlab.com
    IdentityFile C:\Users\maye\.ssh\Gitlab\Mayee\id_ed25519
    User git
  ```

  之后测试 SSH 连接是否成功：

  ```bash:no-line-numbers
  ssh -T git@github.com
  ```

  生成 ssh 密钥也可以使用`ssh-keygen -t rsa -C "deepmi"`，表示使用 RSA 算法生成秘钥。

  如果 SSH 连接的是私有服务器，则在客户机上创建密钥对假设`ssh-keygen -t ed25519 -C "client"`，假设存储密钥自定义路径是`/c/Users/maye/.ssh/trae/ed25519`，之后将密钥复制到服务器假设`ssh-copy-id -i /c/Users/maye/.ssh/trae/ed25519.pub mayee@192.168.0.1`，如果生成密钥时没有修改位置则可以省略掉`-i`参数，然后就可以通过`ssh -i /c/Users/maye/.ssh/trae/ed25519 mayee@192.168.0.1`连接到服务器了，如果不想在连接时指定参数，则可以通过上面的方式在`config`文件中配置连接服务器主机对应的私钥位置。

  **说明**：`ssh key`的类型有四种，分别是`dsa`、`rsa`、`ecdsa`、`ed25519`。根据数学特性，这四种类型又可以分为两大类，`dsa/rsa`是一类，`ecdsa/ed25519`是一类，后者算法更先进。`dsa`因为安全问题，已不再使用了，`ecdsa`因为政治原因和技术原因，也不推荐使用，`rsa`是目前兼容性最好的，应用最广泛的 key 类型，在用`ssh-keygen`工具生成 key 的时候，默认使用的也是这种类型。不过在生成 key 时，如果指定的 key size 太小的话，也是有安全问题的，推荐 key size 是 3072 或更大。`ed25519`是目前最安全、加解密速度最快的 key 类型，由于其数学特性，它的 key 的长度比`rsa`小很多，优先推荐使用。它目前唯一的问题就是兼容性，即在旧版本的 SSH 工具集中可能无法使用。不过据我目前测试，还没有发现此类问题。  
  因此，优先选择`ed25519`，否则选择`rsa`。

  以下是原文：

  > OpenSSH supports several signing algorithms (for authentication keys) which can be divided in two groups depending on the mathematical properties they exploit:
  >
  >DSA and RSA, which rely on the practical difficulty of factoring the product of two large prime numbers, ECDSA and Ed25519, which rely on the elliptic curve discrete logarithm problem. (example)Elliptic curve cryptography (ECC) algorithms are a more recent addition to public key cryptosystems. One of their main advantages is their ability to provide the same level of security with smaller keys, which makes for less computationally intensive operations (i.e. faster key creation, encryption and decryption) and reduced storage and transmission requirements.
  >
  >OpenSSH 7.0 deprecated and disabled support for DSA keys due to discovered vulnerabilities, therefore the choice of cryptosystem lies within RSA or one of the two types of ECC.
  >
  >RSA keys will give you the greatest portability, while #Ed25519 will give you the best security but requires recent versions of client & server\[2\]. #ECDSA is likely more compatible than Ed25519 (though still less than RSA), but suspicions exist about its security (see below).

- Docker-Compose 重建容器
  time=2022-04-29 11:50

  ```bash:no-line-numbers
  docker-compose up -d --force-recreate
  ```

- Fork 项目开发
  time=2022-04-16 03:13

  当 fork 了别人的项目后，进行二次开发，源项目有提交后如何保持更新呢？  
  例如，源仓库为：https://github.com/halo-dev/halo.git, fork 到我的仓库后地址为：https://github.com/maye-e/halo.git。  
  之后在我的仓库中创建 dev 开发分支，stable 稳定分支，可以 release。master 分支不动，保持和源仓库进行同步。  
  将项目从我的仓库中拉取到本地，然后如下操作：

  ```bash::no-line-numbers
  # 1.查看远程仓库：
  git remote -v
  # 显示：
  origin  https://github.com/maye-e/halo.git (fetch)
  origin  https://github.com/maye-e/halo.git (push)

  # 2.设置 upstream 上游仓库(源项目地址)
  git remote add upstream https://github.com/halo-dev/halo.git

  # 3.再次查看远程仓库：
  git remote -v
  # 显示：
  origin  https://github.com/maye-e/halo.git (fetch)
  origin  https://github.com/maye-e/halo.git (push)
  upstream        https://github.com/halo-dev/halo.git (fetch)
  upstream        https://github.com/halo-dev/halo.git (push)

  # 4.同步上游源仓库的 master 分支更改到本地(本地 master 分支，非我的远程仓库)
  ## 4.1.拉取更新的 branches 和 commits
  git fetch upstream
  ## 4.2.切S本地分支
  git checkout master
  ## 4.3.合并
  git merge upstream/master
  # 4.1 ~ 4.3的步骤也可以通过一条语句完成
  git pull upstream master
  ```

  此时，就可以任意进行合并分支了。若要将本地代码 push 到远程仓库：

  ```bash:no-line-numbers
  # 切到要推送的分支，如 master
  checkout master
  # 推送到远程仓库。origin master 表示推送到远程仓库的 master 分支，如果分支不存在则自动创建
  git push origin master
  ```

  另外，如果需要将修改合并到源项目，需要在我的仓库中提交 Pull Request。

- Docker 常用命令
  time=2022-02-19 13:43

  |命令|含义|
  |:-:|:-:|
  |docker kill $(docker ps -a -q)|杀死所有正在运行的容器|
  |docker rm $(docker ps -a -q) |删除所有已经停止的容器|
  |docker images |查看本地镜像|
  |docker ps |查看本地容器|
  |docker build -t `name`:`tag` `Dockerfile路径`|创建镜像|
  |docker exec-it `IMAGE ID`或者`NAME` /bin/bash|进入容器|
  |docker stop `CONTAINER ID`或者`NAMES`|关闭容器|
  |docker start `CONTAINER ID`或者`NAMES`|重新启动关闭的容器|
  |docker rm `CONTAINER ID`或者`NAMES`|移除本地容器|

- npm 设置淘宝代理
  time=2021-10-26 01:37

  ```bash:no-line-numbers
  # 永久设置
  npm config set registry http://registry.npm.taobao.org
  # 查看设置
  npm config get registry
  ```

- Linux 文件目录权限
  time=2021-11-22 17:46

  先看一个例子：`drwxrwxrwx`、`-rwxrwxrwx`。  
  文件权限分别对应 4 个部分: [文件或文件夹] [owner权限] [group权限] [others权限]。
  因此上述例子表示为: [d] [rwx] [rwx] [rwx] 、[-] [rwx] [rwx] [rwx]

  - [-] 表示文件；
  - [d] 表示文件夹，即 directory；

  [rwx] 分别表示拥有的权限：

  - r 可读，read。如果是目录表示有权限执行 ls 命令；
  - w 可写，write。如果是目录表示有权限创建目录；
  - x 可执行，execute。表示有权限执行 ls -l 命令；

  拥有该项权限为 1，没有权限为 0。  
  `drwxrwxrwx` 表示为一个目录，对应权限值为 0777。0 标识这是 8 进制数(逢 8 进 1)。777 转为 2 进制为 111111111，则在
  owner、group、others 下均有可读、可写、可执行权限；  
  `-rwxrwxrwx` 表示为一个文件，对应权限值为 0777。0 标识这是 8 进制数(逢 8 进 1)。777 转为 2 进制为 111111111，在
  owner、group、others 下均有可读、可写、可执行权限。

- Pinpoint部署
  time=2021-01-30 16:02

  部署需要资源：服务器需安装 Docker Compose。当前测试部署的服务器 ip 为 192.168.30.73。

  - 在 GitHub 上 clone [pinpoint-docker](https://github.com/pinpoint-apm/pinpoint-docker) 项目到本地，得到`pinpoint-docker-master.zip`压缩包。
  - 解压后进入到`pinpoint-docker-master`目录中，将`docker-compose.yml`和`.env`两个文件拷贝一份出来。
  - 打开`.env`文件，将第一行 PINPOINT_VERSION=2.2.1 修改为 2.2.0，保存文件；再打开`docker-compose.yml`文件，其中 services 节点下包含 pinpoint-hbase、pinpoint-mysql、pinpoint-web、pinpoint-collector、pinpoint-quickstart、pinpoint-agent 等子节点。首先可以删除掉 pinpoint-quickstart 和 pinpoint-agent 这两个节点，接着再将 pinpoint-hbase、pinpoint-mysql、pinpoint-web、pinpoint-collector 这 4 个节点下的 build 节点删除，保存文件。
  - 将修改后的`.env`和`docker-compose.yml`文件上传至服务器，然后执行命令：docker-compose pull & docker-compose up -d，等待自动拉取镜像，启动容器，用时3分钟左右。
  - 在 GitHub 上访问 pinpoint 的 [release](https://github.com/pinpoint-apm/pinpoint/releases) 页，下载 2.2.0 release notes
    下的 pinpoint-agent-2.2.0.tar.gz 文件并解压，进入到 pinpoint-agent-2.2.0\profiles\release 目录下，打开`pinpoint.config`文件，搜索 ".ip" 将127.0.0.1替换为服务器真实 ip 192.168.30.73；再搜索 "profiler.sampling.rate" 将 20 修改为 1。
  - 打开浏览器，访问 192.168.30.73:8079 即可。
  - java -jar 启动服务时，加上如下 jvm 参数：

  ```text
  -javaagent:/home/pinpoint/agent/pinpoint-bootstrap-1.8.0.jar 
  -Dpinpoint.agentId=(要全局唯一建议用hostname，部署多个jvm的话加前缀)
  -Dpinpoint.applicationName= 设置项目的名称(如果同一项目部署两台实例,这两台的参数应该一致)
  ```

:::
