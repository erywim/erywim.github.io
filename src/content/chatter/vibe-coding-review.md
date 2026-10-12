---
title: 'vibe coding 的代码 review'
description: ''
publishDate: 2026-10-12
tags: [VibeCoding]
draft: false
---
最近被 magpie 仓库所震撼到了，作者可能是构建了一个工作流，自动捕获 issue ，修复代码，但是我并不认为他对代码进行了人工review。更多的可能是交给了 ai 进行 check。

这是 ai 分析仓库得出有关于质量保证/回归测试的简要几点

```markdown
  防回退五件套

  1. 回归测试：修复必须带"没它就挂"的测试，reviewer 放回旧代码验证
  2. 兄弟规则：修一个 bug，grep 所有同类位置一起修
  3. 重推导：改了什么，重跑所有依赖它的调用方/数据/测试
  4. 文档同步：改了子系统行为，同 PR 更新设计文档 + 写明前后行为
  5. 全链路审查：从用户输入追到最终结果，不停在改动的行

  issue 处理四步

  1. 用报告者的环境复现再修
  2. fixture 用真实字节，不编造样本
  3. 查根因（不只改文案）
  4. issue 留 open 到报告者确认

  兜底纪律

  - main 上红测试 = 立即修的 bug，"和 main 一样红"不算数
  - 大 commit 写 body 记录跑了什么；打完 tag 等 CI 全绿
  - 测试沙盒（临时 HOME）；测试启动的进程随测试结束
  - 每天复盘 commit → 教训入 LESSONS.md → 出现 3 次升入 code-standards.md
```

或许 ai review 会是大势所趋，人可能更多的是注重产品侧，或者只是简单 review 大致逻辑。
我应当从现在开始累积这种质量保证的方式，以及在完成react，go的完全掌握（个人定义的是不用 ai 能 coding 出一个中小型项目）后，学习机器学习/深度学习前，可以专门抽取一两周时间去沉淀出一套自己的工作流。
> 目前 react go ddl 是 1 month