---
title: Docker创建容器命令
createTime: 2025/01/10 17:50:32
permalink: /notes/qr0e6712/
---

## Docker

国内镜像源

```json
{
  "registry-mirrors": [
    "https://registry.docker-cn.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://ung2thfc.mirror.aliyuncs.com",
    "https://mirror.ccs.tencentyun.com"
  ]
}
```

### Mysql

```docker
docker pull mysql
docker run --name mysql -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 mysql:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

root 用户开启远程登录：

```sql
use mysql;
update user set host='%' where user ='root'; -- 更新域属性，'%' 表示允许外部访问
FLUSH PRIVILEGES;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'WITH GRANT OPTION;
```

### Etcd

```docker
docker pull bitnami/etcd
docker run --name etcd -d --publish 12379:2379 --publish 12380:2380 --env ALLOW_NONE_AUTHENTICATION=yes --env ETCD_ADVERTISE_CLIENT_URLS=http://127.0.0.1:12379 bitnami/etcd:latest
```

`2379`和`2380`端口被占用，主机端口映射为`12379`和`12380`

### Nacos

```docker
docker pull nacos/nacos-server
docker run --name nacos -d -e MODE=standalone -p 8848:8848 -p 9848:9848 nacos/nacos-server:latest
```

### Clickhouse

```docker
docker pull clickhouse/clickhouse-server:22.12.2
docker run --name clickhouse -d -e CLICKHOUSE_USER=root -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 -e CLICKHOUSE_PASSWORD=123456 --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000/tcp -p 9004:9004 clickhouse/clickhouse-server:22.12.2
```

`8123`是 clickhouse 客户端使用的端口，需要下载 `clickhouse-jdbc`的驱动包。
如果不想下载驱动包，clickhouse 也完全兼容 MySQL(使用 9004 端口) 和 Postgresql(使用 9005 端口)。
配置文件在 /etc/clickhouse-server/config.xml 中。

当创建数据库引擎选择 mysql 时，mysql 的 ip 使用 localhost 或 127.0.0.1 会报错 code:501 提示 Connections to all replicas failed。此时将 ip 换成局域网地址，如：192.168.31.52 即可。(tip: clickhouse 和 mysql 都是 docker 部署，且都没有指定 network)

clickhouse 22 版本新增了 JSON 类型，需要指定下载 22 版本。这是项实验性功能，因此必须在建表语句之前加上`SET allow_experimental_object_type = 1;`，和建表语句一起执行。
JSON 类型限制比较多，它要求这一列的数据格式必须一模一样，否则插入数据会报错，若某一次插入的数据多了一个字段，则会自动将其他所有行的本列数据都加上这个字段，并赋予零值。

### MongoDB

```docker
docker pull mongo
docker run --name mongo -d -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=123456 -p 27017:27017 mongo:latest
```

### Redis

```docker
docker pull redis
docker run --name redis -d -p 6379:6379 redis:latest
// RedisStack
docker run -d --name redis-stack --restart=always  -v redis-data:/data -p 6379:6379 -p 8001:8001 -e REDIS_ARGS="--requirepass 123456" redis/redis-stack:latest
```

### RocketMQ

```docker
# 拉取镜像
docker pull xuchengen/rocketmq:latest
# 创建卷
docker volume create rocketmq_data
# PowerShell 运行
docker run -itd `
 --name=rocketmq `
 --hostname rocketmq `
 --restart=always `
 -p 8080:8080 `
 -p 9876:9876 `
 -p 10909:10909 `
 -p 10911:10911 `
 -p 10912:10912 `
 -v rocketmq_data:/home/app/data `
 -v /etc/localtime:/etc/localtime `
 -v /var/run/docker.sock:/var/run/docker.sock `
 xuchengen/rocketmq:latest
```

在 http://localhost:8080 中访问 UI。
帐号：admin   密码：admin
帐号：normalt 密码：normal
参考：[dockerhub](https://hub.docker.com/r/xuchengen/rocketmq)、[github](https://github.com/Xuchengen/rocketmq-docker-build)、[博客](https://www.xuchengen.cn/category/docker)

### Jarger

```docker
# 拉取镜像
docker pull jaegertracing/all-in-one:latest
# PowerShell 运行
docker run -d --name jaeger `
  -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 `
  -p 5775:5775/udp `
  -p 6831:6831/udp `
  -p 6832:6832/udp `
  -p 5778:5778 `
  -p 16686:16686 `
  -p 14268:14268 `
  -p 14250:14250 `
  -p 9411:9411 `
  jaegertracing/all-in-one:latest
```

访问 [UI](http://localhost:16686)。
参考：[本地运行 Jaeger](https://devpress.csdn.net/opensource/62f3a0d7c6770329307f8ae6.html#devmenu12)