---
title: 'coding agent 的token黑洞：找寻上下文信息'
description: '每当开启一个新会话/新任务时，agent最先做的往往是从你的仓库中找到相关上下文'
publishDate: 2026-09-08
tags: [Agent, LLM, VibeCoding]
draft: false
---
# 即耗时又费钱：补全上下文信息带来的token黑洞

每当开启一个新会话/新任务时，agent最先做的往往是从你的仓库中找到相关上下文。显而易见，这种方式会消耗大量token并且极其耗时。这个现象在codex中尤其显著（claude code的搜索策略就很克制我就很喜欢，但是公司以提供gpt账号为主 T^T ），即便是关闭了自带的 `hunt skill` 他也会通过 subagent 的形式进行找寻相关代码，有种力大砖飞的美感。


或许我们需要一个方式去以功能为维度解耦代码，每次来的新需求 or 修复旧bug 时遍历功能list既可以直接定位到目标代码。忙完这个需求去调研下，似乎code graph好像能做到？


> 例如某次运行流程如下：
> 
> ```text
> 已读取Openspec Archive Change 技能
> 已在 MEMORY.md 中搜索“implement-exam-management|exam management|archive|OpenSpec|question_key|ReferenceBundle”
> 已读取 MEMORY.md
> ```
> 实际上MEMORY.md的内容完全可以和claude code一样用个小模型进行语义检索，在输入前就把相关memory检索到然后扔进去，这里还走了一次工具调用，浪费钱钱😠
> 
> 更新：我chovy，codex你读记忆给我读好了啊。一轮对话里面主agent读了数不清多少次MEMORY.md，我仔细一个这个md文件，为什么所有项目的记忆都放在这里啊！你倒是做分层啊我chovy！一个memory.md 9万字符，你怎么敢的啊！ 
>
>（叠个甲，要是后面发现是我使用不当那我自己删☝️🤓。不过应该不会，我是直接开箱即用，配了点mcp和skill，这样能用错就说明有很大的优化空间）
>
> 浪费生命，这下Tibo送我重置次数我也不原谅他了 😡




