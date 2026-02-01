---
title: 开发环境
createTime: 2025/01/10 17:50:44
permalink: /notes/vej2ba8o/
---

> 记录使用 deepin 系统时，配置常用开发环境

在`~/.bashrc`文件中找到`ll`的命令，解开注释并修改为`alias ll='ls -lA'`和`alias ls='ls -CF'`，然后执行`source ~/.bashrc`使配置生效。

## Java

访问 Oracle JDK [下载](https://www.oracle.com/java/technologies/downloads/)页面，下载`x64 Debian Package`选项的`.deb`文件。
打开终端，执行`sudo dpkg -i jdk-22_linux-x64_bin.deb`命令即可完成安装。JDK 将会被安装在`/usr/lib/jvm`目录下。

-- 参考[官方文档](https://docs.oracle.com/en/java/javase/22/install/installation-jdk-linux-platforms.html#GUID-CF001E7F-7E0D-49D4-A158-9CF3ED4C247C)

## Go

访问 Go 官网[下载](https://go.dev/dl/)页面，下载`Linux`选项的`.tar.gz`文件，然后解压出其中的`go`文件并移动至`/usr/local`目录下，然后在用户目录`~`下新建`go`目录。

再打开`~/.bashrc`文件中新增`export PATH="$PATH:/usr/local/go/bin"`，然后在终端中执行`source ~/.bashrc`即可使配置生效。

接着配置`go env`变量，依次执行如下命令：

```bash
go env -w GOROOT=/usr/local/go
go env -w GOPATH=/home/$(whoami)/go
go env -w GOBIN=/home/$(whoami)/go/bin
go env -w GOPROXY=https://goproxy.io,direct
```

-- 参考[Go官方文档](https://go.dev/doc/install)、[GOPROXY.IO官方文档](https://proxy.golang.com.cn/zh/docs/getting-started.html)

## Node.js

Node.js 推荐使用`nvm`来安装并管理`node`版本，执行如下命令即可完成安装：

```bash
# 下载并安装 nvm，命令被安装在 ~/.config/nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
# 如果提示找不到 nvm 命令，新建终端并执行此命令即可完成安装
nvm install 20
```

-- 参考[官方文档](https://nodejs.org/zh-cn/download/package-manager)

当使用`pnpm`管理工程时：

- `pnpm init`: 初始化工程
- `pnpm add xxx`: 安装依赖包
- `pnpm install`: 解析依赖文件，安装全部依赖包

## Python

Python 预装在大多数 Linux 发行版上，deepin 上也有，所以无需额外安装。

-- 参考[官方文档](https://docs.python.org/zh-cn/3/using/unix.html#on-linux)

安装完 Python(3.13.4版本) 后，以 WinDows 为例，安装目录在`C:\Users\<用户名>\AppData\Local\Programs\Python\Python313\`，pip 目录在`C:\Users\<用户名>\AppData\Local\Programs\Python\Python313\Scripts\`。  
在 Python 安装目录的 bin 目录下，默认只有`python.ext`，但有时一些脚本会用`python3`命令执行，此时系统会认为你没有安装 python 转而要你下载，此时我们可以建立软连接`cd <python安装目录/bin/> && mklink python3.exe python.exe`。

当使用[Poetry](https://python-poetry.org/docs/#installation)来管理 Python 工程时，`poetry`命令默认被安装在`C:\Users\<用户名>\AppData\Roaming\Python\Scripts`，全局虚拟环境在`C:\Users\<用户名>\AppData\Roaming\pypoetry\venv`。

- `poetry new xxx`: 初始化一个工程
- `poetry install`: 安装全部依赖包
