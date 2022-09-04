---
title: Kubernetes 入门 （4）
date: 2022-08-31 00:35:11
tags:
  - Kubernetes
  - DevOps
  - Docker
  - Cloud Native
---


# 网络

其实 Pod 只要部署好了，就会被分配到一个集群内部的 IP 地址，流量就可以通过 IP 地址来访问 Pod 了。然而通过可能会有很大问题： **Pod 随时会被杀死。** 虽然通过用 Deployment 等资源可以在挂掉后重新创建一个 Pod ，但那毕竟是不同的 Pod ， IP 已经改变。

另外， Deployment 等资源的就是为了能更方便的做到多副本部署及任意缩容扩容而存在的。如果在 K8s 中访问 Pod 还需要小心翼翼地去找到 Pod 的 IP 地址，或是去寻找 Pod 是否部署了新副本， Deployment 等资源就几乎没有存在价值了。

> 其实 Pod 部署好后不止会被分配 IP 地址，还会被分配到一个类似 `<pod-ip>.<namespace>.pod.cluster.local` 的 DNS 记录。例如一个位于 default 名字空间，IP 地址为 172.17.0.3 的 Pod ，对应 DNS 记录为 `172-17-0-3.default.pod.cluster.local` 。

### Service

在古代，人们是通过注册中心、服务发现、负载均衡等中间件来解决上面这些问题的，但这样很不云原生。于是 K8s 引入了 Service 这种资源，来实现简易的服务发现、 DNS 功能。

下面是一个经典的例子，部署了一个 Service 和一个 Deployment：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  labels:
    app: auth
spec:
  type: ClusterIP
  selector:
    app: auth # 指向 Deployment 创建的 Pod
  ports:
  - port: 80 # Service 暴露的端口
    targetPort: 8080 # Pod 的端口
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name:  auth
  labels:
    app: auth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth
  template:
    metadata:
      name: auth
      labels:
        app: auth
    spec:
      containers:
      - name: auth
        image: xxxxx.dkr.ecr.ap-northeast-1.amazonaws.com/auth:xxxxx
        ports:
        - containerPort: 8080
```

根据前面的知识我们知道，这份文件会部署 Deployment 会创建 2 个相同的 Pod 副本。另外还会部署一个名为 auth-service 的 Service 资源。这个 Service 暴露了一个 80 端口，并且指向那两个 Pod 的 8080 端口。

而这份文件部署后， Service 资源就会在集群中注册一个 DNS A 记录（或 AAAA 记录），集群内其他 Pod （为了辨别我们叫它 Client ）就可以通过相同的 DNS 名称来访问 Deployment 部署的这 2 个 Pod ：

```sh
curl http://auth-service.<namespace>.svc.cluster.local:80
# 或者省略掉后面的一大串
curl http://auth-service.<namespace>:80
# 如果 Client 和 Service 在同一个 Namespace 中，还可以：
curl http://auth-service:80
```

像这样 Client 通过 Service 来访问时，会随机访问到其中一个 Pod ，这样一来无论 Deployment 到底创建了多少个副本，只要副本的标签相同，就能通过同一个 DNS 名称来访问，还能自动实现一些简单的负载均衡。

> **为什么 DNS 名称可以简化？**
> 
> Pod 被部署时， kubelet 会为每个 Pod 注入一个类似如下的 `/etc/resolv.conf` 文件：
> 
> ```
> nameserver 10.32.0.10
> search <namespace>.svc.cluster.local svc.cluster.local cluster.local
> options ndots:5
> ```
> 
> Pod 中进行 DNS 查询时，默认会先读取这个文件，然后按照 `search` 选项中的内容展开 DNS 。例如，在 test 名称空间中的 Pod ，访问 data 时的查询可能被展开为 data.test.svc.cluster.local 。
> 更多关于 `/etc/resolv.conf` 文件的内容可参考 https://www.man7.org/linux/man-pages/man5/resolv.conf.5.html

### Service 的种类

我们上面的例子中，可以看到 Service 资源有个字段 `type:ClusterIP` 。其实 Service 资源有以下几个种类：

| 种类           | 作用                                                                                                                                                                                                                                                                                             |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClusterIP`    | 这个类型的 Service 会在集群内创建一条 DNS A 记录并通过一定方法将流量代理到其指向的 Pod 上。这种 Service 不会暴露到集群外。这是最基础的 Service 种类。                                                                                                                                            |
| `NodePort`     | 这种 Service 会在 ClusterIP 的基础上，在所有节点上各暴露一个端口，并把端口的流量也代理到指向的 Pod 上。可以通过这种方法从集群外访问集群内的资源。                                                                                                                                                |
| `LoadBalancer` | 这种 Service 会在 ClusterIP 的基础上，在所有节点上各暴露一个端口，并在集群外创建一个负载均衡器来将外部流量路由到暴露的端口，再把流量代理到指向的 Pod 上。这种 Service 一般需要调用云服务提供的 API 或是额外安装的插件。如果什么插件都没安装的话，这种 Service 部署后会与 `NodePort` 的表现一样。 |
| `ExternalName` | 这种 Service 不需要 selector 字段指定后端，而是用 externalName 字段指定一个外部 DNS 记录，然后将流量全部指向外部服务。如果打算将集群内的服务迁移到集群外、或是集群外迁移到集群内，这种类型的 Service 可以实现无缝迁移。                                                                          |

### 虚拟 IP 与 Headless Service

如果你在集群内尝试对 Service 对应的 DNS 记录进行域名解析，会发现返回来的 IP 地址与 Service 指向的任何一个 Pod 对应的 IP 地址都不相同。如果你还尝试了去 Ping 这个 IP 地址，会发现不能 Ping 通。为什么会这样呢？

原来，每个 Service 被部署后， K8s 都会给他分配一个集群内部的 IP 地址，也就是 Cluster IP （这也是最基础的 Service 种类会起名叫 Cluster IP 的原因）。

但是这个 Cluster IP 不会绑定任何的网卡，是一个虚拟 IP 。然后 K8s 中有一个叫 kube-proxy 的组件（这里叫他做组件，是因为 kube-proxy 与 Service 、 Deployment 等不一样，不是一种资源而是 K8s 的一部分）， kube-proxy 通过修改 iptables ，将虚拟 IP 的流量经过一定的负载均衡规则后代理到 Pod 上。

![K8s 官网上的虚拟 IP 图](https://d33wubrfki0l68.cloudfront.net/27b2978647a8d7bdc2a96b213f0c0d3242ef9ce0/e8c9b/images/docs/services-iptables-overview.svg)

> **为什么不使用 DNS 轮询？**
> 
> 为什么 K8s 不配置多条 DNS A 记录，然后通过轮询名称来解析？为什么需要搞出虚拟 IP 这么复杂的东西？这个问题 K8s 官网上也有特别提到原因：
> 
> - DNS 实现的历史由来已久，它不遵守记录 TTL，并且在名称查找结果到期后对其进行缓存。
> - 有些应用程序仅执行一次 DNS 查找，并无限期地缓存结果。
> - 即使应用和库进行了适当的重新解析，DNS 记录上的 TTL 值低或为零也可能会给 DNS 带来高负载，从而使管理变得困难。

有些时候（比如想使用自己的服务发现机制或是自己的负载均衡机制时）我们确实也会想越过虚拟 IP ，直接获取背后 Pod 的 IP 地址。这时候我们可以将 Service 的 `spec.clusterIP` 字段指定为 `None` ，这样 K8s 就不会给这个 Service 分配一个 Cluster IP 。这样的 Service 被称为 **Headless Service** 。

Headless Service 资源会创建一组 A 记录直接指向背后的 Pod ，可以通过 DNS 轮询等方式直接获得其中一个 Pod 的 IP 地址。另外更重要的一点， Headless Service 还会创建一组 SRV 记录，包含了指向各个 Pod 的 DNS 记录，可以通过 SRV 记录来发现所有 Pod 。

我们可以在集群里用 nsloopup 或 dig 命令去验证一下：

```sh
# 在集群的 Pod 内部运行
$ nslookup kafka-headless.kafka.svc.cluster.local
Server:     10.96.0.10
Address:    10.96.0.10#53

Name:   kafka-headless.kafka.svc.cluster.local
Address: 172.17.0.6
Name:   kafka-headless.kafka.svc.cluster.local
Address: 172.17.0.5
Name:   kafka-headless.kafka.svc.cluster.local
Address: 172.17.0.4

$ dig SRV kafka-headless.kafka.svc.cluster.local
# .....
;; ANSWER SECTION:
kafka-headless.kafka.svc.cluster.local.      30      IN      SRV     0 20 9092 kafka-0.kafka-headless.kafka.svc.cluster.local.
kafka-headless.kafka.svc.cluster.local.      30      IN      SRV     0 20 9092 kafka-1.kafka-headless.kafka.svc.cluster.local.
kakfa-headless.kafka.svc.cluster.local.      30      IN      SRV     0 20 9092 kafka-2.kafka-headless.kafka.svc.cluster.local.

;; ADDITIONAL SECTION:
kafka-0.kafka-headless.kafka.svc.cluster.local. 30 IN A  172.17.0.6
kafka-1.kafka-headless.kafka.svc.cluster.local. 30 IN A  172.17.0.5
kafka-2.kafka-headless.kafka.svc.cluster.local. 30 IN A  172.17.0.4
```

> 拥有 Cluster IP 的 Service 其实也有 SRV 记录。但这种情况的 SRV 记录中对应的 Target 仍为 Service 自己的 FQDN 。

### 第三次回到 Stateful Set

在上面 Headless Service 的例子中，我们看到，各个 Pod 对应的 DNS A 记录格式为 `<pod_name>.<svc_name>.<namespace>.svc.cluster.local` 。不对啊，之前的小知识里不是说过 Pod 被分配的 DNS A 记录格式应该是 `172-17-0-3.default.pod.cluster.local` 的吗？

其实 Headless Service 还有一个众所周知的隐藏功能。 Pod 这种资源本身的参数中有 `subdomain` 字段和 `hostname` 字段，如果设置了这两个字段，这个 Pod 就拥有了形如 `<hostname>.<subdomain>.<namespace>.svc.cluster.local` 的 FQDN （全限定域名）。如果这时刚好在同一名称空间下有与 `subdomain` 同名的 Headless Service ， DNS 就会用为这个 Pod 用它的 FQDN 来创建一条 DNS A 记录。

比如 Pod1 在 `kafka` 名称空间中， `hostname` 为 `kafka-1` ， `subdomain` 为 `kafka-headless` ，那么 Pod1 的 FQDN 就是 `kafka-1.kafka-headless.kakfa.svc.cluster.local` 。而同样在 `kafka` 名称空间中，刚好又有一个 `kafka-headless` 的 Headless Service ，那么 DNS 就会创建一条 A 记录，就可以通过 `kafka-1.kafka-headless.kafka.svc.cluster.local` 来访问 Pod1 了。当然，由于 DNS 展开，也可以用 `kafka-1.kafka-headless.kafka` 甚至是 `kafka-1.kafka-headless` 来访问这个 Pod 。

其实这些 Pod 是用 Stateful Set 来部署的，这一部分其实是 Stateful Set 相关的功能。之前我们说到 Stateful Set 有唯一稳定的网络标识。我们现在就来详细讲讲，这“唯一稳定的网络标识”到底是在指什么。

我们来看一下这个 kafka Stateful Set 到底是怎么部署的：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kafka-headless
spec:
  clusterIP: None # 这是一个 headless service
  ports:
  - name: tcp-client
    port: 9092
    protocol: TCP
    targetPort: kafka-client
  selector:
    select-label: kafka-label
  type: ClusterIP
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  replicas: 3
  serviceName: kafka-headless # 注意到这里有 serviceName 字段
  selector:
    matchLabels:
      select-label: kafka-label
  template:
    metadata:
      labels:
        select-label: kafka-label
    spec:
      containers:
      - name: kafka
        image: docker.io/bitnami/kafka:3.1.0-debian-10-r52
        # 接下来 Pod 相关部分省略
  # 下面 Volume 相关部分也省略
```

我们看到， Stateful Set 的定义中必须要用 `spec.serviceName` 字段指定一个 Headless Service 。 Stateful Set 创建 Pod 时，会自动给 Pod 指定 `hostname` 和 `subdomain` 字段。这样一来，每个 Pod 才有了唯一固定的 hostname ，唯一固定的 FQDN ，以及通过与 Headless Service 共同部署而获得唯一固定的 A 记录。（此外，其实当 Pod 因为版本升级等原因被重新创建时，相同序号的 Pod 还会被分配到相同固定的集群内 IP 。）

> **关于 Stateful Set 中 `serviceName` 字段的争议**
> 
> Stateful Set 中的 serviceName 字段是必填字段。这个字段唯一的作用其实就是给 Pod 指定 subdomain 。其实这样会有一些问题：
> 
> 1. Stateful Set 部署时不会检查是否真的存在这么一个 Headless Service 。如果 serviceName 乱填一个值，会导致虽然 Pod 的 `hostname` 和 `subdomain` 都指定了却没有创建 A 记录的情况。
> 2. 有时 Stateful Set 的 Pod 不需要接收流量，也不需要相互发现，这时候还强行需要指定一个 serviceName 显得有点多余。
> 
> 在 GitHub 上有关于这个问题的 Issue ： https://github.com/kubernetes/kubernetes/issues/69608

### 从集群外部访问

在 K8s 集群里把应用部署好了，可是如何让集群外部的客户端访问我们集群中的应用呢？这可能是大家最关心的问题。

不过有认真听的同学估计已经有这个问题的答案了。之前我们讲过 NodePort 和 LoadBalancer 这两种 Service 类型。

其中 NodePort Service 只是简单地在节点机器上各开一个端口，而如何路由、如何负载均衡等则一概不管。

而 LoadBalancer Service 则是在 NodePort 的基础上再加一个一个负载均衡器，然后把节点暴露的端口注册到这个负载均衡器上。这样一来，集群外部的客户端就可以通过同一个 IP 来访问集群中的应用。但是要使用 LoadBalancer Service ，一般需要先安装云供应商提供的 Controller ，或是安装其他第三方的 Controller （比如 Nginx Controller ）。

在 Service 之外还另有一种资源类型叫 Ingress ，也可以用来实现集群外部访问集群内部应用的功能。 Ingress 其实也会在集群外创建一个负载均衡器，因此也需要预先安装云供应商的 Controller 。但 Ingress 与 Service 不同的是，它还会管理一定的路由逻辑，接收流量后可以根据路由来分配给不同的 Service 。

| 类型                 | OSI 模型工作层数 | 依赖于云平台或其他插件 |
| :------------------- | :--------------- | :--------------------- |
| NodePort Service     | 第四层           | 否                     |
| LoadBalancer Service | 第四层           | 是                     |
| Ingress              | 第七层           | 是                     |

特别再详细说一下 Ingress 这种资源。 Ingress 本身不会在集群内的 DNS 上创建记录，一般也不会主动去路由集群内的流量（除非你在集群内强行访问 Ingress 的负载均衡器…… 不过一般也没什么理由要这样做对吧）。但 Ingress 可以根据 HTTP 的 hostname 和 path 来路由流量，把流量分发到不同的 Service 上。 Ingress 也是 K8s 的原生资源里唯一能看到 OSI 第七层的资源。

下面是 AWS 的 EKS 服务中部署的一个 Ingress 的例子（集群中已安装 AWS Load Balancer Controller ）：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/backend-protocol-version: GRPC
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/healthcheck-path: /grpc.health.v1.Health/Check
    alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
    alb.ingress.kubernetes.io/success-codes: 0,12
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:xxxxxxxxxx:certificate/xxxxxxxxxx

    external-dns.alpha.kubernetes.io/hostname: sample.example.com
  
  name: gateway-ingress
spec:
  rules:
  - host: sample.example.com
    http:
      paths:
      - path: /grpc.health.v1.Health
        pathType: Prefix
        backend:
          service:
            name: health-service
            port:
              number: 50051
      - path: /proto.sample.v1.Sample
        pathType: Prefix
        backend:
          service:
            name: sample-service
            port:
              number: 50051
```

可以看到， Ingress 资源可以通过 `spec.rules` 字段中定义各条规则，通过 hostname 或是 path 等第七层的信息来进行路由。 Ingress 部署下去后， AWS Load Balancer Controller 会读取会根据的配置，并在云上创建一个 AWS Application Load Balancer （ALB），而 `spec.rules` 会应用到 ALB 上，由 ALB 来负责流量的路由。

我们也会注意到，怎么 `metadata.annotations` 里有这么多奇奇怪怪的字段！ Ingress 本身的功能都是 AWS Load Balancer Controller 调用 AWS 的 API 创建 ALB 来实现的。但 AWS 的 ALB 能实现的功能可不止 Ingress 字段定义的这些，比如安装 TLS 证书、 health check 等 spec 字段中描述不下的功能，就只能是通过 annotation 的形式来定义了。

> 小彩蛋：可以看到例子中的 Ingress 资源 annotation 字段里还有一行 `external-dns.alpha.kubernetes.io/hostname: sample.example.com` 。其实这个 K8s 集群中还安装了 external-dns 这个应用，它可以根据 annotation 来在外部 DNS 上直接创建 DNS 记录！有了这个插件我们可不用再慢慢打开公共 DNS 管理页面，再小心翼翼地记下 IP 地址去添加 A 记录了。

# 更高级的部署方式（一）

一路说道这里， K8s 中最基础的资源大部分都已经介绍了。但是，这么多资源之间又需要相互配合，只部署一种资源基本没什么生产能力。

比如只部署 Deployment 的话，我们确实是能在一组多副本的 Pod 里跑起可执行程序，但这组 Pod 却几乎没办法接受集群里其他 Pod 的流量（只能通过制定 Pod 的 IP 来访问，但 Pod 的 IP 是会变的）。因此一般来说一个 Deployment 都会搭配一个 Service 来使用。这还是最简单的一种搭配了。

假若我们现在要在自己的 K8s 里安装一个别人提供的应用。当然由于 K8s 是基于容器的，只要别人提供了他应用的 yaml 清单，我们只用把清单用 `kubectl apply -f` 提交给 K8s ，然后让 K8s 把清单中的镜像拉下来就能跑了。可如果我们需要根据环境来改一些参数呢？

如果别人提供的 yaml 文件比较简单还好说，改改对应的字段就好了。如果别人的应用比较复杂，那改 yaml 文件可就是一个大难题了。比如 AWS 的 Load Balancer Controller ，它的 yaml 清单文件可是多达 939 行！

[[aws-elb-controller-lines.png]]

在这种复杂的场景下，我们就需要一些更高级的部署方式了。

### Helm

首先来介绍的是 Helm 。 Helm 是一个包管理工具，可以类比一下 CentOS 中的 yum 工具。它可以把一组 K8s 资源发布成一个 Chart ，然后我们可以用 Helm 来安装这个 Chart ，并且可以通过参数设值来改变 Chart 中的部分资源。利用 Helm 安装 Chart 后还可以管理 Chart 的升级、回滚、卸载。

使用别人提供的 Helm Chart 前，需要先 add 一下 Chart 的仓库，然后再安装仓库里提供的 Chart 。比如我们要安装 bitnami 提供的 Kafka Chart 时：

```bash
# 添加 https://charts.bitnami.com/bitnami 这个仓库，命名为 bitnami
helm repo add bitnami https://charts.bitnami.com/bitnami

# 在 kafka 名称空间里安装 bitnami 仓库里的 kafka Chart ，并通过参数设置为 3 个副本，并同时安装一个 3 副本的 Zookeeper
helm install kafka -n kafka \
  --set replicaCount=3 \
  --set zookeeper.enabled=true \
  --set zookeeper.replicaCount=3 \
  bitnami/kafka
```

命令执行后， helm 就会根据参数与 Chart 的内容，在 K8s 里安装 StatefulSet 、 Service 、 ConfigMap 等一切所需要的资源。

```sh
$ k -n kafka get all,cm
NAME                    READY   STATUS    RESTARTS      AGE
pod/kafka-0             1/1     Running   1             46d
pod/kafka-1             1/1     Running   3             46d
pod/kafka-2             1/1     Running   3             46d
pod/kafka-zookeeper-0   1/1     Running   0             46d
pod/kafka-zookeeper-1   1/1     Running   0             46d
pod/kafka-zookeeper-2   1/1     Running   0             46d

NAME                               TYPE           CLUSTER-IP       EXTERNAL-IP      PORT(S)                      AGE
service/kafka                      ClusterIP      172.20.1.196     <none>           9092/TCP                     164d
service/kafka-headless             ClusterIP      None             <none>           9092/TCP,9093/TCP            164d
service/kafka-zookeeper            ClusterIP      172.20.227.236   <none>           2181/TCP,2888/TCP,3888/TCP   164d
service/kafka-zookeeper-headless   ClusterIP      None             <none>           2181/TCP,2888/TCP,3888/TCP   164d

NAME                               READY   AGE
statefulset.apps/kafka             3/3     164d
statefulset.apps/kafka-zookeeper   3/3     164d

NAME                                DATA   AGE
configmap/kafka-scripts             2      164d
configmap/kafka-zookeeper-scripts   2      164d
configmap/kube-root-ca.crt          1      165d
```

甚至， Helm 可以通过模板生成的 Pod 环境变量，来预先设置好 Kafka 的配置，让他找得到 Zookeeper 服务：

```yaml
apiVersion: v1
kind: Pod
# 略去无关信息
spec:
  containers:
  - name: kafka
    command:
    - /scripts/setup.sh
    env:
    - name: KAFKA_CFG_ZOOKEEPER_CONNECT
      value: kafka-zookeeper
    # ...
```

通过设置 `KAFKA_CFG_ZOOKEEPER_CONNECT` 这个环境变量，指定了 Kafka Broker 可以通过访问 `kafka-zookeeper` 来找到 zookeeper 服务。（还记得 zookeeper 的 Service 名字是 `kafka-zookeeper` 吗？ zookeeper 与 kafka 部署在同一个名称空间里，因此可以直接通过 Service 名访问。）

如果我们打开这个 helm chart 对应的[代码仓库](https://github.com/bitnami/charts/tree/master/bitnami/kafka)，会发现原来有一组 go template 文件，以及一个 `values.yaml` 文件和 `Chart.yaml` 文件：

```sh
.
├── Chart.lock
├── Chart.yaml
├── README.md
├── templates
│   ├── NOTES.txt # 这里定义的是 helm 工具的命令行信息
│   ├── _helpers.tpl # 这里面是一些定义好的 go template 代码块可以供其他模板使用
│   ├── configmap.yaml
│   ├── statefulset.yaml
│   ├── svc-headless.yaml
│   ├── svc.yaml
│   └── # 以下省略若干模板文件
└── values.yaml
```

- `Chart.yaml` 中定义了这个 Chart 的基本信息，包括名称、版本、描述、依赖等。
- `values.yaml` 中定义了这个 Chart 的默认参数，包括各种资源的默认配置、副本数量、镜像版本等。其中的值都可以通过 `helm install` 命令的 `--set` 参数来覆盖。
- `templates/` 文件夹下的都是 go template 的模板文件。

`helm install` 就是通过用 `values.yaml` 中预定义的参数，渲染 `templates/` 文件夹下的 go template 文件，生成最终的 yaml 文件，然后再通过 kubectl apply -f 的方式，将 yaml 文件里的资源部署到 K8s 里。然后通过忘资源里注入一些特殊 annotation 的方式来记住自己部署了那些资源，进而提供 `update` 、 `uninstall` 等功能。

关于更多 Helm 的内容，可以参考[官方文档](https://helm.sh/docs/)。

### Kustomize

另一个部署工具是 Kustomize 。之前提到 Config Map 时的例子中，将配置文件的内容直接写进了 yaml 清单的一个字段里：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: game-demo
data:
  # 一个 Key 可以对应一个值
  player_initial_lives: "3"
  ui_properties_file_name: "user-interface.properties"

  # 一个 Key 也可以对应一个文件的内容
  game.properties: |
    enemy.types=aliens,monsters
    player.maximum-lives=5    
  user-interface.properties: |
    color.good=purple
    color.bad=yellow
    allow.textmode=true    
```

其实这样很不好，先不说这样写没办法在 IDE 里用配置文件自己的语法检查，每行还需要一定的缩进，如果配置文件有好几百行，你甚至会忘了这一行到底是哪个配置文件！此时我们就会自然而然的想把每个配置文件以单独文件的形式保存。

Kustomize 就是这样一个工具，它可以帮助我们把每个配置文件以单独文件的形式保存，然后再通过一个 `kustomization.yaml` 文件，将这些配置文件组合起来，生成最终的 yaml 文件。

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  # 其他资源也可以单独使用一个文件定义
  - deployment.yaml

# 用 configMapGenerator 从文件中生成 ConfigMap
configMapGenerator:
  - name: game-demo
    literals:
      - "ui_properties_file_name=user-interface.properties"
      - "player_initial_lives=3"
    # 从文件中读取内容
    files:
      - game.properties
      - user-interface.properties
# 有多个 configMap 时，可以通过统一的 generatorOptions 来设置一些通用的选项
generatorOptions:
  disableNameSuffixHash: true
```

然后两个配置文件的内容可以单独用文件定义，此时可以结合 IDE 的语法检查，以及代码补全功能，来编写配置文件。

```properties
# user-interface.properties
color.good=purple
color.bad=yellow
allow.textmode=true    
```

然后将 `kustomization.yaml` 和其他所需的文件都放在同一个目录下：

```bash
.
├── kustomization.yaml
├── deployment.yaml
├── game.properties
└── user-interface.properties
```

然后就可以通过 `kubectl apply -k ./` 来将整个 kustomize 文件夹转换为 yaml 清单直接部署到 K8s 中。
（没错，现在 Kustomize 已经成为 kubectl 中的内置功能！可以不用先 `kustomize build` 生成 yaml 文件再 `kubectl apply` 两步走了！）

值得提醒的是，虽然 `kustomization.yaml` 有 `apiVersion` 和 `kind` 字段，长得很像一个资源清单，但其实 K8s 的 API server 并不认识他。 Kustomize 的工作原理其实是先根据 `kustomization.yaml` 生成 K8s 认识的 yaml 资源清单，然后再通过 `kubectl apply` 来部署。

除了可以直接将 ConfigMap 与 Secret 中的文件字段内容用单独的文件定义外， Kustomize 还有其他比如为部署的资源添加统一的名称前缀、添加统一字段等功能。这些大家可以阅读 Kustomize 的[官方文档](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)来了解。

### 各种工具的优缺点

我们目前已经知道有三种在 K8s 中部署资源的方式： `kubectl apply`、Helm 和 Kustomize 。

其中 `kubectl apply` 的优缺点很明确，优点是最简单直接，缺点是会导致要么 yaml 清单过长，要么需要分多文件多次部署，使集群中产生中间状态。

而 Helm 与 Kustomize 我们上面也分析过，其实都是基于 `kubectl apply` 的。 Helm 是通过 go template 先生成 yaml 文件再 `kubectl apply` ，而 Kustomize 是通过 `kustomization.yaml` 中的定义用自己的一套逻辑生成 yaml 文件，然后再 `kubectl apply` 。

Helm 的优点是 Helm Chart 安装时可以直接使用别人 Helm 仓库中已经上传好的 Chart ，只需要设置参数就可以使用。这也是 Kustomize 的缺点：如果想要使用别人提供的 Kustomization 而只修改其中的一些配置，必须要先把放 `kustomization.yaml` 的整个文件夹下载下来才能做修改。

而 Helm 的缺点也是明显的， Helm 依赖于往资源里注入特殊的 annotation 来管理 Chart 生成的资源，这可能会很难与集群中现有的一些系统（比如 Service Mesh 或是 GitOps 系统等）放一起管理。而 Kustomize 生成的 yaml 清单就是很干净的 K8s 资源，原先的 K8s 资源该是什么表现就是什么表现，与现有的系统兼容一般会比较好。

而另外，由于 Helm 与 Kustomize 都是基于 `kubectl apply` 的，因此他们有共同的缺点，就是不能做 `kubectl apply` 不能做的事情。

什么叫 `kubectl apply` 不能做的事情呢？比如说我们要在 K8s 中部署 Redis 集群。聪明的你可能就想到要用 Stateful Set 、 PVC 、 Headless Service 来一套组合拳。这确实可以部署一个多节点、有状态的 Redis Cluster 。可是如果我们要往 Redis Cluster 里加一个节点呢？

你当然可以把 Stateful Set 中的 `Replicas` 字段加个 1 然后用 `kubectl apply` 部署，可是这实际上只能增加一个一个 Redis 实例 —— 然后什么都没发生。其他节点不认识这个新的节点，访问这个新节点也不能拿到正确的数据。要知道往 Redis Cluster 里加节点，是要先让集群发现这个新节点，然后还要迁移 slot 的！ `kubectl apply` 可不会做这些事。

> Well, 其实这些也是可以通过增加 initContainer 、修改镜像增加启动脚本等方式，实现用 `kubectl apply` 部署的。可是，这会让整个 Pod 资源变得很难理解，也不好维护。而且，如果不是因为做不到，谁会想去修改别人的镜像呢？

我们接下来会介绍 K8s 的核心架构，来理解我们之前讲的这些资源到底是怎么工作的。最后会引出一组新的概念： Operator 与自定义资源（ Custom Resource Definition ，简称 CRD ）。通过 Operator 与 CRD ，我们可以做到 `kubectl apply` 所不能做到的事，包括 Redis Cluster 的扩容。

> DIO: `kubectl apply` 的能力是有限的……
> 越是部署复杂的应用，就越会发现 `kubectl apply` 的能力是有极限的……除非超越 `kubectl apply` 。
> 
> JOJO: 你到底想说什么？
> 
> DIO: 我不用 `kubectl apply` 了！ JOJO ！
> （其实还是要用的）

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.