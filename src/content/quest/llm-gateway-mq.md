---
title: 'LLM 网关加一层消息队列会怎样'
desc: '现在我的LLM网关架构中请求是直接命中服务器，但是如果要追求更高的QPS，以及对于用户粒度的速率进行限制，怎么优化捏'
type: main
status: todo
diff: 3
objectives:
  - { t: '如何保证 cache 命中', done: false }
  - { t: '集群场景消息如何路由回用户', done: false }
  - { t: '流式场景是否适用', done: false }
exp: 160
gold: 110
---
