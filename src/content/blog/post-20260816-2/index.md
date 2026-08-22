---
title: '《Building multi-agent systems: when and how to use》笔记'
description: 'muilti-agent构建工程化指导'
publishDate: 2026-03-10
gold: 16
exp: 70
rank: S
category: 笔记
tags: [anthropic,agent,multi-agent]
draft: false
---

> 原文链接：https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
> 
> # ▍这个博客可以提供什么解决思路
> 
> 它在尽可能向观众诠释什么情况下我们不应该使用多智能体。因为在很多情况下，引入多智能体解决的事情，通过修改单智能体的提示词也能够达到相同的效果。但是引入多智能体会产生额外的 `通信开销` 以及成本通常是单智能体的3\~10倍，每个agent都需要维护自己的上下文，最后是延迟，多一个agent就多一次网络请求，就多一个故障点。
> 
> 本文介绍了
> 
> - 三个特定的场景下，多agent效果优于单agent
> 
> - 如果决定用多智能体，应当遵循的原则有哪些
> 
> - 一个简单易上手的多智能体切入角度
> 
> 

# ▍为什么要优先使用单体Agent



“想象一下你是一位主厨，原本切菜炒菜备菜样样精通，虽然忙但是你心里有数，所有信息都在你脑子里，没有任何沟通成本。现在你听到多Agent很多，所以招了三个助手，一个专门负责炒菜，一个专门负责切菜，一个专门负责摆盘，这虽然看起来很好，但实际上你需要花大量的时间去协调他们的工作，这就是 `通信开销`。就有点像当初微服务架构出来时，单体服务和微服务之间的优劣争论”



Anthropic 团队分享：他们见过很多团队在花费大量成本实现了多Agent的架构后，发现通过修改单Agent的提示词也能够达到相同的效果。

> Today, multi-agent systems are often applied in situations where a single agent would perform better, though this calculus continues to evolve as models improve\. At Anthropic, we’ve seen teams invest months building elaborate multi-agent architectures only to discover that improved prompting on a single agent achieved equivalent results\.
> 
> 



## ▍单智能体的优势



一个设计良好的单智能体配合适当工具，其能力远超许多开发者的预期。



## ▍多智能体的隐性成本



每个额外的智能体代表：

- 另一个**潜在的故障点**

- 另一组**需要维护的提示词**

- 另一个**意外行为的来源**

    

例如：

构建了一个包含**规划、执行、审查、迭代**四个独立智能体的复杂系统，结果发现：

- 每次交接都**丢失上下文**

- 花费更多 Token 在**协调**而非执行上

    

**数据对比**：多智能体实现通常比单智能体方法多使用 **3-10 倍 Token**。



**开销来源**：

1. 跨智能体**复制上下文**

2. 智能体间的**协调消息**

3. 交接时的**结果摘要**



---



# ▍在什么场景下可以使用多智能体



## ▍三种真正有效的场景



|场景|核心问题|解决方案|
|---|---|---|
|**上下文保护**|上下文污染导致性能下降|子智能体提供隔离，各自在干净上下文中运行|
|**并行化**|单智能体无法覆盖大搜索空间|多智能体并行探索不同维度|
|**专业化**|工具选择困难或行为冲突|专门化智能体匹配特定工具集和领域|



---



## ▍场景一：上下文保护（Context Protection）



大语言模型有有限的上下文窗口，随着上下文增长，响应质量会下降。当智能体的上下文累积了与后续子任务无关的信息时，就会发生**上下文污染（Context Pollution），从而导致模型注意力分散，无法准确的按照预想中的方式运行**。



子智能体可以提供**隔离**，对高噪声的信息进行过滤，让主Agent可以在专注于其特定任务的干净上下文中运行。



考虑你的Agent需要处理一个用户的技术故障，为了明白状况，它需要查询用户的历史订单，结果API一下子返回了5000字的完整日志，包含每一次下单，每一次物流节点、每一条退换货记录，如果将这些内容全部发送给Agent，那么它的注意力大概率可能被冲散。它可能本来需要解决无法登录的问题，结果看完日志后变成了分析“为什么上个月快递变慢了”



### ▍这种场景适用条件：

- 条件一：子任务通常会产生大量上下文。通常指 **单次工具调用 **、**一次检索操作** 等，返回的内容动辄超过1000个Token。

- 条件二：这些信息大部分与主线任务无关，这些信息可能是正确的，真实的。但是对当前主线决策来说，并不相关。

- 条件三：这些信息在被使用前必须要被过滤和筛选。



在满足这三个条件下，我们就可以设计一个独立的子 Agent ，它的任务是过滤，它负责读取那五千字的日志，然后只提取出核心结论，最后只把几十到一两百的token量级的关键信息返回给大脑。

**在这里，多Agent的价值是：为核心大脑保留一片净土，保护它的上下文不被污染**



### ▍代码示例

**单智能体方法的问题**：

```python
# ▍单智能体在上下文中累积所有内容
conversation_history = [
    {"role": "user", "content": "我的订单 #12345 无法使用"},
    {"role": "assistant", "content": "让我检查您的订单..."},
    # ▍工具结果添加 2000+ Token 的订单历史
    {"role": "user", "content": "... (订单详情、过往购买、物流信息) ..."},
    {"role": "assistant", "content": "现在让我诊断技术问题..."},
    # ▍上下文现在被智能体不需要的订单详情污染
]
```



**多智能体解决方案**：

```python
from anthropic import Anthropic

client = Anthropic()

class OrderLookupAgent:
    def lookup_order(self, order_id: str) -> dict:
        # ▍独立智能体，拥有自己的上下文
        messages = [
            {"role": "user", "content": f"获取订单 {order_id} 的关键详情"}
        ]
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=messages,
            tools=[get_order_details_tool]
        )
        # ▍仅返回关键信息
        return extract_summary(response)

class SupportAgent:
    def handle_issue(self, user_message: str):
        if needs_order_info(user_message):
            order_id = extract_order_id(user_message)
            # ▍仅获取所需内容，而非完整历史
            order_summary = OrderLookupAgent().lookup_order(order_id)
            # ▍注入紧凑摘要，而非完整上下文
            context = f"订单 {order_id}: {order_summary['status']}, 购买于 {order_summary['date']}"

        # ▍主导智能体上下文保持干净
        messages = [
            {"role": "user", "content": f"{context}\n\n用户问题: {user_message}"}
        ]
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            messages=messages
        )
        return response
```



---



## ▍场景二：并行化（Parallelization）



单智能体在处理复杂查询时，只能串行地逐个探索不同维度，受限于上下文窗口和推理能力，往往会遗漏重要信息或浅尝辄止。当一个问题需要从多个独立角度深入调查时，单智能体的"单线程"思维模式会成为瓶颈。



并行化允许多个智能体同时探索问题的不同维度，每个子智能体在独立的上下文中深度挖掘，最后由主导智能体综合各方发现。**这种模式不是为了让系统更快，而是为了让系统更全**——覆盖单智能体无法触及的信息空间。



想象你要研究"新能源汽车市场格局"，这涉及技术路线、政策环境、供应链、消费者偏好、竞争对手动态等多个维度。如果让一个智能体依次研究，它可能在完成技术路线分析后，上下文已经被锂电池、固态电池等技术细节填满，轮到分析政策时，已经没有足够的"脑力"去深入理解补贴政策、碳排放法规的复杂互动。更不可控的是，它可能为了节省上下文空间，主动放弃某些维度的探索。



### ▍这种场景适用条件：

- 条件一：问题可以分解为**相互独立的研究维度**，各维度之间没有强顺序依赖关系，可以并行推进。

- 条件二：信息空间足够大，可以有多个维度，每个维度都需要**深度探索**，而非简单查询，单次探索可能消耗大量上下文。典型例子是 deep research，在这类任务中，漏掉一个维度比慢几秒更难以接受。

- 条件三：**覆盖范围比一致性更重要**，允许不同子智能体采用不同的搜索策略和关注重点。



在满足这三个条件下，我们就可以设计多个独立的子 Agent，每个 Agent 专注于一个研究维度，拥有自己完整的上下文窗口进行深度挖掘。最后由主导 Agent 汇总、去重、解决冲突，形成全面的研究报告。



在这里，多 Agent 的价值是：**突破单智能体的上下文瓶颈，通过空间换深度，实现信息覆盖的几何级扩展。**



**关键点**：这种模式会消耗 3-10 倍 Token，且由于总计算量增加，实际执行时间往往比单智能体更长。它的核心价值是**彻底性**——当你需要确保没有遗漏关键信息时，这种"地毯式搜索"是值得的。

### ▍代码示例



单智能体方法的局限：

```python
# ▍单智能体串行研究，上下文被早期维度耗尽
conversation_history = [
    {"role": "user", "content": "研究新能源汽车市场格局"},
    {"role": "assistant", "content": "让我从技术路线开始..."},
    # ▍技术细节填满 3000+ Token 上下文
    {"role": "user", "content": "... (锂电池、固态电池、氢燃料电池技术对比) ..."},
    {"role": "assistant", "content": "现在分析政策环境..."},
    # ▍剩余上下文不足，政策分析只能浅尝辄止
    {"role": "user", "content": "... (简单提及补贴政策) ..."},
    # ▍供应链、消费者偏好等维度被完全忽略或极度简化
]
```



多智能体解决方案：

```python
import asyncio
from anthropic import AsyncAnthropic

client = AsyncAnthropic()

async def research_topic(query: str) -> dict:
    # ▍主导智能体将查询分解为独立研究维度
    facets = [
        "技术路线：电池技术、驱动系统、智能化水平",
        "政策环境：补贴政策、碳排放法规、准入标准", 
        "供应链：电池原材料、芯片、制造设备",
        "竞争格局：主要厂商市场份额、战略动向",
        "消费者偏好：购买动机、价格敏感度、品牌认知"
    ]

    # ▍生成子智能体并行研究每个维度
    tasks = [
        research_subagent(facet)
        for facet in facets
    ]
    results = await asyncio.gather(*tasks)

    # ▍主导智能体综合发现，解决冲突，形成统一报告
    return await lead_agent.synthesize(results)

async def research_subagent(facet: str) -> dict:
    """每个子智能体拥有自己的完整上下文窗口"""
    messages = [
        {"role": "user", "content": f"深度研究以下维度，提供详细分析：{facet}"}
    ]
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4096,  # ▍充分利用上下文进行深度挖掘
        messages=messages,
        tools=[web_search, read_document, analyze_data]
    )
    return {
        "facet": facet,
        "findings": extract_findings(response),
        "sources": extract_sources(response),
        "confidence": assess_confidence(response)
    }
```



---

## ▍场景三：专业化（Specialization）



单智能体在应对复杂多样的任务时，常常面临三种困境：工具太多导致选择困难、行为要求冲突导致风格摇摆、领域知识太深导致上下文被挤占。这三种困境分别对应三种专业化需求：工具专业化、提示词专业化和领域专业化。



### ▍困境一：工具专业化



当单智能体被赋予过多工具时，它会陷入"选择困难症"。面对 20\+ 工具，模型不仅要花费大量注意力去理解每个工具的功能，还要在每次决策时从大量选项中筛选，这会导致工具选择错误、参数填充错误，甚至完全忽略某些工具的存在。更严重的是，当工具跨越多个不相关领域时，智能体会混淆相似功能的工具——比如把 CRM 的"获取客户"和营销系统的"获取线索"搞混，或者在处理退款时误用了发送营销邮件的接口。



**适用条件**：

- 工具数量超过 15-20 个，选择准确率显著下降

- 工具跨越多个不相关领域，存在功能相似但用途不同的工具（例如发送短信和发送邮件）

- 添加新工具后发现会降低现有任务的性能

    

**解决方案**：将工具按领域分组，每个子智能体只拥有该领域的聚焦工具集。



---



### ▍困境二：提示词专业化



不同任务需要不同的"人格"和行为模式。客服需要共情和耐心，代码审查需要精确和批判，合规检查需要严格和保守，头脑风暴需要创意和开放。当这些冲突的行为模式被塞进同一个系统提示词时，智能体会表现得摇摆不定——面对用户投诉时过于冷漠，面对代码错误时又过于宽容，无法形成稳定可靠的服务风格。



**适用条件**：

- 同一系统需要处理性质冲突的任务（如既要做创意策划又要做合规审查）

- 不同任务对沟通风格、决策原则、验证标准有截然不同的要求

- 单智能体在切换"人格"时表现不稳定或需要频繁提醒

    

**解决方案**：为不同行为模式创建独立的子智能体，每个拥有定制的系统提示词，固化其角色定位。



---



### ▍困境三：领域专业化



某些任务需要深厚的领域背景知识才能做好。法律分析需要理解案例法、监管框架和判例逻辑；医学研究需要掌握临床试验方法学、统计显著性标准和伦理审查流程；如果把这些知识全部加载到通用智能体中，要么挤占任务执行的上下文空间，要么因为知识不足而做出肤浅或错误的判断。



**适用条件**：

- 任务需要大量专业背景知识才能正确理解和执行

- 领域知识会显著挤占任务上下文的可用空间

- 通用智能体的输出在专业深度上无法满足要求

    

**解决方案**：创建携带专门领域上下文的子智能体，让它们专注于特定领域的深度推理。

---



在这里，多 Agent 的价值是：**通过三维度的专业化分工——工具聚焦降低选择负担、角色固化保证行为一致、知识隔离确保专业深度——让系统整体表现优于任何单一通用智能体。**



**关键点**：专业化引入了额外的路由和协调成本，所设计的协调器必须**准确识别**请求中的**领域意图和任务边界**。专业化产生正收益的前提是：任务边界清晰、职责划分明确，且路由决策本身不模糊。如果连人都很难判断一个任务该交给谁，那么多智能体的专业化结构往往可能放大混乱，而不是减少错误。



### ▍代码示例



单智能体方法的问题：

```python
# ▍单智能体面对 40+ 工具和冲突的行为要求
available_tools = [
    # ▍CRM 工具（15个）
    crm_get_contact, crm_update_deal, crm_create_account, 
    crm_merge_duplicates, crm_assign_owner, ...
    # ▍营销工具（15个）  
    marketing_send_email, marketing_create_campaign, 
    marketing_score_lead, marketing_segment_audience, ...
    # ▍开发工具（15个）
    code_review_file, code_run_tests, code_deploy_staging,
    code_check_security, ...
]

system_prompt = """你是一个企业助手，可以访问 CRM、营销和开发工具。
你需要：对客户耐心共情、对代码严格批判、对营销有创意、对合规保守谨慎...
"""

# ▍用户请求："审查这段代码并给客户发送审查报告"
# ▍问题1：工具选择混乱 - 可能用 marketing_send_email 发送代码审查
# ▍问题2：行为冲突 - 对代码审查过于宽容（因为提示词强调了对客户要耐心）
# ▍问题3：知识不足 - 缺乏安全编码的深度知识，遗漏了关键漏洞
```



多智能体解决方案：

```python
from anthropic import Anthropic

client = Anthropic()

class CRMAgent:
    """处理客户关系管理 - 工具专业化 + 提示词专业化"""
    system_prompt = """你是 CRM 专家。管理联系人、商机和账户记录。
    沟通风格：专业、简洁、注重数据准确性。对客户耐心共情，善于倾听需求。
    严格遵循数据隐私规范，更新前始终验证记录所有权。"""
    tools = [
        crm_get_contacts,
        crm_create_opportunity,
        crm_update_deal_status,
        # ▍仅 8-10 个 CRM 专用工具，无干扰
    ]

class MarketingAgent:
    """处理营销自动化 - 工具专业化 + 提示词专业化"""
    system_prompt = """你是营销自动化专家。管理活动、线索评分和邮件序列。
    沟通风格：创意、有说服力、注重用户体验。善于发现增长机会。
    优先考虑数据卫生，尊重联系人偏好，严禁垃圾邮件和过度营销。"""
    tools = [
        marketing_get_campaigns,
        marketing_create_lead,
        marketing_send_nurture_email,
        # ▍仅 8-10 个营销专用工具，无干扰
    ]

class CodeReviewAgent:
    """处理代码审查 - 工具专业化 + 提示词专业化 + 领域专业化"""
    system_prompt = """你是资深代码审查专家，专注于安全性和架构质量。
    沟通风格：精确、批判、直接指出问题。对代码质量零容忍，不因人情而放松标准。
    
    领域知识：
    - 安全：OWASP Top 10、注入攻击、权限绕过、敏感数据泄露
    - 架构：设计模式、SOLID原则、性能反模式
    - 合规：GDPR数据处理、SOC2审计要求
    
    审查时必须：1) 运行完整测试套件 2) 检查安全漏洞 3) 评估架构合理性"""
    tools = [
        code_review_file,
        code_run_tests,
        code_check_security,
        code_analyze_performance,
        # ▍仅代码审查相关工具
    ]
    # ▍预加载的领域知识（通过 RAG 或长期上下文）
    domain_knowledge = load_security_patterns() + load_architecture_guidelines()

class OrchestratorAgent:
    """协调器 - 仅负责理解和路由，无业务逻辑"""
    def execute(self, user_request: str):
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system="""你协调企业平台。分析用户意图中的领域关键词，路由到专家：
- CRM关键词：客户、联系人、商机、销售、账户、跟进
- 营销关键词：活动、线索、邮件、推广、转化、受众
- 开发关键词：代码、审查、测试、部署、Bug、架构、安全

你的任务只是理解和路由，不直接处理业务逻辑。如果请求涉及多个领域，按顺序调用相应专家并整合结果。""",
            messages=[{"role": "user", "content": user_request}],
            tools=[delegate_to_crm, delegate_to_marketing, delegate_to_code_review]
        )
        return route_and_consolidate(response)

# ▍处理复杂请求："审查新功能代码，如果通过就给相关客户发送上线通知"
def handle_complex_request(user_request: str):
    # ▍步骤1：代码审查（CodeReviewAgent - 严格批判风格）
    code_result = CodeReviewAgent().review_code(feature_code)
    
    if not code_result["passed"]:
        return "代码审查未通过，需修复：\n" + code_result["issues"]
    
    # ▍步骤2：查询相关客户（CRMAgent - 专业简洁风格）
    customers = CRMAgent().get_customers_for_feature(feature_id)
    
    # ▍步骤3：发送通知（MarketingAgent - 创意有说服力风格）
    notification = MarketingAgent().craft_launch_email(feature_info, customers)
    
    return f"代码已通过审查，已通知 {len(customers)} 位客户"
```



---

# ▍什么时候该考虑拆分单智能体（单智能体架构的极限信号）



**核心原则**：这些阈值是实用指导原则，而非根本约束。当前模型能力下的"极限"，可能在下一代模型发布后就变得无关紧要。因此，在投入多智能体架构之前，先确认单智能体确实无法通过提示工程、工具优化或上下文管理来满足需求。



### ▍信号一：接近上下文限制



**现象**：智能体 经常 使用大量上下文，且响应质量明显下降。具体表现为：模型开始遗忘早期对话内容、重复询问已提供的信息、或无法有效整合远距离的上下文线索。



**注意事项**：上下文工程正在降低这个限制的影响。单智能体现在能够维护更持久的有效记忆，因此这种情况下先尝试上下文优化方案（如摘要、分层记忆、外部存储检索）。



---



### ▍信号二：管理过多工具



**现象**：当智能体拥有 15-20\+ 工具时，模型花费大量上下文和注意力理解选项，工具选择准确率下降，或频繁出现参数填充错误。



**替代方案**：在采用多智能体架构之前，考虑使用**工具搜索工具（Tool Search Tool）**。这种模式让智能体动态发现工具，而非一次性加载所有工具定义。这可以减少高达 **85% 的 Token 使用**，同时提高工具选择准确率。



**原理**：工具搜索工具本身是一个工具，它接收任务描述，返回最相关的工具子集。智能体只在需要时获取工具定义，而非在每次对话开始时加载全部 20\+ 工具。



Tool Search Tool 是 Anthropic 推出的一个功能，国内模型暂时没看到有类似的概念。详见：https://docs\.anthropic\.com/en/docs/agents-and-tools/tool-use/tool-search-tool

---



### ▍信号三：可并行化的子任务



**现象**：任务自然分解为独立部分（如跨多个来源的研究、多个组件的测试），串行执行导致总时间过长，且各子任务之间没有依赖关系。



**价值**：并行子智能体可以提供显著的**吞吐量提升**（注意：不一定是延迟降低，因为总计算量增加，但用户感知的等待时间可能减少）。



---







### ▍

# ▍如果已经决定使用多智能体了，应该遵循什么原则

## ▍关键设计原则：以上下文为中心的分解



当决定采用多智能体架构时，最重要的设计决策是**如何在智能体间划分工作**。这是多智能体系统成败的关键，但许多团队在此犯错，导致协调开销抵消了多智能体的收益。



## ▍错误方式：以问题为中心的分解



**做法**：按工作类型划分智能体——一个智能体写功能，另一个写测试，第三个审查代码。



**问题**：这创造了持续的协调开销。每次交接时上下文都在进行反复的切换和传递：

- 测试编写智能体并不知道Agent当初为什么要这么写

- 代码审查者智能体也不知道已经探索过的方案和迭代过的上下文

- 结果就是智能体不得不反复解释背景，陷入"传话游戏"，信息在传递中失真

    

**Anthropic 实验证据**：在按软件开发角色（规划者、实现者、测试者、审查者）专门化的智能体实验中，子智能体在协调上花费的 Token 比在实际工作上还多。



---



## ▍正确方式：以上下文为中心的分解



**核心原则**：按上下文边界划分工作。工作只应在上下文可以**真正隔离**时才被分割。这意味着在设计Agent边界时，首要考虑的不是任务类型，而是这些任务是否依赖同一套上下文信息。 



**类比**：人类团队协作中，你不会让一个人写需求文档，另一个人完全不了解背景就写代码，第三个人再不了解前两者就写测试。相反，全栈开发者拥有需求设计、代码编写、编写测试的完整上下文，所以它能完成这些工程，只在需要外部专家（如安全审计）时才引入新角色。



### ▍有效与无效的分解边界



**有效的分解边界**：



|边界类型|说明|示例|
|---|---|---|
|**独立研究路径**|各路径可并行进行，无共享上下文|调查"亚洲市场趋势" vs "欧洲市场趋势"|
|**干净接口的分离组件**|已经具备接口定义，接口调用方和实现方不知道彼此之间的具体实现|前端和后端通过 REST API 协作，具备清晰的接口定义|
|**黑盒验证**|验证者只需关注输入输出，无需实现细节|测试运行者只需知道如何执行测试套件|



**无效的分解边界**：



|边界类型|说明|示例|
|---|---|---|
|**同一工作的顺序阶段**|规划、实现、测试共享太多上下文|同一功能的规划者、实现者、测试者分离|
|**紧耦合组件**|两个模块需要频繁来回同步细节和理解，那他们本质上就属于同一个上下文单元<br>|数据库模式和业务逻辑分离到不同智能体|
|**需要共享状态的工作**|需要频繁同步项目状态、项目进行到哪一步<br>|两个智能体同时编辑同一文件的相邻部分|



---



### ▍实践建议



在设计多智能体系统时，需要回答几个问题：



1. **这些智能体真的需要隔离吗？** 如果它们需要频繁交换信息，可能应该合并。

2. **上下文转移的成本是什么？** 如果交接时需要传递大量背景信息，分解可能不值得。

3. **能否定义干净的接口？** 如果边界模糊，协调逻辑会变得复杂且易错。

    

---



# ▍一种容易上手的实践方式——验证子智能体模式



在多智能体架构中，有一个模式被证明在跨领域都表现良好：**验证子智能体（Verification Subagent）**。这是一个专门负责测试或验证主导智能体工作的专用智能体。



## ▍为什么这个模式特别有效



验证子智能体成功是因为它**规避了传话游戏问题**。验证本质上需要**最小上下文转移**——验证者可以黑盒测试一个系统，无需了解构建的完整历史。（注意，这里并非上文说的 “编写测试”，测试用例的编写是需要了解具体实现逻辑的白盒测试，而这里只关心输入A是否能得到B或类似物即可）



**辨析**：

- **测试智能体**：需要传递"为什么这样实现"的上下文，否则测试覆盖不全

- **验证智能体**：只需传递"输入什么应该得到什么输出"，验证者独立判断

    

---



## ▍适用场景演变

|场景|主Agent|验证Agent|
|---|---|---|
|合规检查|写合同|用法务手册去查，看条款在不在合同中。这个过程中他不需要懂法律逻辑|
|事实核查|写文章|搜索google，验证每一个数据的真实性|
|格式校验|生成数据|校验JSON格式是否正确|

**共同特征**：这些场景都需要**客观标准**和**最小上下文转移**，适合黑盒验证。



---



### ▍主要失败模式：早期胜利问题



验证子智能体最显著的失败模式是**未经彻底测试就标记输出为通过**。



**现象**：验证者运行一两个测试，观察到通过，就宣布成功。

**原因**：LLM倾向于顺从用户想尽快结束对话，但缺乏"必须彻底"的强制约束。



**解决策略**：建议直接写入System Prompt

|策略|具体做法|
|---|---|
|**具体标准**<br>|指定"运行完整测试套件并报告所有失败项"，而非模糊的"确保它能工作"|
|**全面检查**|强制要求验证者覆盖测试多个场景、边界情况和负面案例。例如空值、超长文本|
|**负面测试**|指导验证者尝试输入会导致失败的用力，并且确认它们确实失败。如果无论输入什么都说是“成功”，那么就说明测试过程是假的|
|**显式指令**|必须包含："你必须在标记为通过前运行完整测试套件"|



**关键洞察**：验证者的提示词需要像对待"偷懒的学生"一样，明确禁止 shortcuts（捷径），强制彻底性。



---



### ▍实现模式



```python
from anthropic import Anthropic

client = Anthropic()

class CodingAgent:
    def implement_feature(self, requirements: str) -> dict:
        """主导智能体实现功能，拥有完整实现上下文"""
        messages = [
            {"role": "user", "content": f"实现: {requirements}"}
        ]
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            messages=messages,
            tools=[read_file, write_file, list_directory]
        )
        return {
            "code": response.content,
            "files_changed": extract_files(response),
            "test_plan": extract_test_plan(response)  # ▍可能包含测试建议
        }

class VerificationAgent:
    def verify_implementation(self, requirements: str, files_changed: list) -> dict:
        """独立智能体验证，最小上下文，专注验证"""
        messages = [
            {"role": "user", "content": f"""
需求: {requirements}
变更文件: {files_changed}

你的任务：黑盒验证实现是否满足需求。
你不需要知道代码如何编写，只需验证：
1. 运行完整测试套件，所有测试通过
2. 手动验证关键功能按需求工作
3. 检查明显的安全或性能问题

运行: pytest --verbose
仅当所有测试通过时才标记为 PASSED。
"""}
        ]
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            messages=messages,
            tools=[run_tests, execute_code, read_file]  # ▍只读访问，不修改
        )
        return {
            "passed": extract_pass_fail(response),
            "test_coverage": extract_coverage(response),
            "issues": extract_issues(response)
        }

def implement_with_verification(requirements: str, max_attempts: int = 3):
    """带验证的实现循环"""
    for attempt in range(max_attempts):
        # ▍实现阶段：完整上下文，自由探索
        result = CodingAgent().implement_feature(requirements)
        
        # ▍验证阶段：干净上下文，专注测试
        verification = VerificationAgent().verify_implementation(
            requirements,
            result['files_changed']
        )

        if verification['passed']:
            return {
                "status": "success",
                "implementation": result,
                "verification": verification
            }

        # ▍失败反馈：将验证结果加入需求，重新实现
        requirements += f"\n\n上次尝试失败: {verification['issues']}"

    raise Exception(f"{max_attempts} 次尝试后验证失败")
```



---



# ▍总结与行动建议



在添加多协调智能体的复杂性之前，确认：



1. **真正的约束存在**：上下文限制、并行化机会或专业化需求，且单智能体确实无法解决

2. **分解遵循上下文而非问题类型**：按上下文需求分组工作，而非按工作类型

3. **清晰的验证点存在**：子智能体可以在无需完整上下文的情况下验证工作

    

## ▍决策检查清单



```text
□ 是否已尝试优化单智能体的提示词？
□ 是否已尝试上下文管理技术（摘要、压缩、外部存储）？
□ 是否已尝试工具搜索模式减少工具负载？
□ 多智能体的收益是否明确超过 3-10x 的 Token 成本增加？
□ 分解边界是否真正隔离了上下文，而非创造协调开销？
```



## ▍最终建议



> "从最简单的有效方法开始，仅在证据支持时才添加复杂性。"
> 
> Our advice? Start with the simplest approach that works, and add complexity only when evidence supports it\.
> 
> 



多智能体系统是强大的工具，但不是万能药。许多团队投入数月构建复杂架构，最终发现改进单智能体的提示词就能达到同等效果。在投入多智能体之前，确保已经：

- 充分挖掘单智能体的潜力

- 明确识别单智能体无法克服的硬约束

- 设计了以上下文为中心的分解方案

- 准备了应对协调开销和复杂性增加的方案

    

---



## ▍系列文章



> *This is the first in a series of posts on multi-agent systems\. For more on single-agent patterns, see *[*Building effective agents*](https://www.anthropic.com/engineering/building-effective-agents)*\. For context management strategies, see *[*Effective context engineering for AI agents*](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)*\. For a deep dive into how we built our multi-agent research system, see *[*How we built our multi-agent research system*](https://www.anthropic.com/engineering/multi-agent-research-system)*\.*
> 
> 



- **下一篇**：其他多智能体模式详解（智能体群、基于能力的系统、消息总线架构）

- **相关阅读**：

    - 《Building effective agents》：单智能体模式深度解析

    - 《Effective context engineering for AI agents》：上下文管理策略

    - 《How we built our multi-agent research system》：多智能体研究系统实战





