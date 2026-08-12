---
title: '测试文章'
description: '这是一篇测试文章草稿。'
publishDate: 2026-08-12
rank: A
category: 笔记
tags:
  - Java
  - Python
  - Agent
draft: false
---

## ▍任务摘要

（在这里写下文章的开头……）

## ▍第一章 · ThreadLocal 示例

```java
private ThreadLocal<Integer> local = new ThreadLocal<>().withInitial(() -> 0);
@Override
public void run() {
    local.set(local.get() + 1);
    System.out.println(Thread.currentThread().getName()+"    local.get() = " + local.get());
}
```

其中 t1 线程和 t2 线程都会拥有一个专属于自己线程的 local 变量，其值为初始值 0 。所以最终输出的结果是：

```
t1    local.get() = 1
t2    local.get() = 1
```

## ▍终章 · 待填写

（章节内容……）
