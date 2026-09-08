---
title: 'coding agent 的token黑洞：找寻上下文信息'
description: '每当开启一个新会话/新任务时，agent最先做的往往是从你的仓库中找到相关上下文'
publishDate: 2026-09-08
tags: [Agent, LLM, VibeCoding]
draft: false
---
# 即耗时又费钱：补全上下文信息带来的token黑洞

每当开启一个新会话/新任务时，agent最先做的往往是从你的仓库中找到相关上下文。显而易见，这种方式会消耗大量token并且极其耗时。这个现象在codex中尤其显著（claude code的搜索策略就很克制，但是公司以提供gpt账号为主 T^T ），即便是关闭了自带的 `hunt skill` 他也会通过 subagent 的形式进行找寻相关代码，有种力大砖飞的美感。


或许我们需要一个方式去以功能为维度解耦代码，每次来的新需求 or 修复旧bug 时遍历功能list既可以直接定位到目标代码。忙完这个需求去调研下，似乎code graph好像能做到？






