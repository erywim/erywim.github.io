/**
 * 勇者档案（关于页）数据
 * 已按公网发布要求脱敏：不包含真实姓名 / 联系方式 / 精确商业指标，
 * 任职公司以行业代称呈现。
 */

/** 冒险历程节点的像素图标：edu=学士帽 / telecom=信号塔 / ai=机器人头 */
export type HeroTimelineIcon = 'edu' | 'telecom' | 'ai'

export interface HeroTimelineItem {
  icon: HeroTimelineIcon
  date: string
  title: string
  desc: string
}

export const hero: {
  name: string
  class: string
  stats: {
    hp: { value: number; max: number }
    mp: { value: number; max: number }
    exp: { value: number; max: number }
  }
  bio: string
  location: string
  status: string
  skills: { title: string; chips: string[] }[]
  timeline: HeroTimelineItem[]
} = {
  name: 'erywim',
  class: '勇者 · 全栈 Agent 开发工程师',
  stats: {
    hp: { value: 92, max: 100 },
    mp: { value: 95, max: 100 },
    exp: { value: 46, max: 100 }
  },
  bio: '喜欢动漫；喜欢摄影；喜欢技术探讨互相学习；还喜欢写点代码，把自己天马行空想象的内容做出来是一件非常有意思的事情～',
  location: '中国/北京',
  status: '跳槽中',
  skills: [
    { title: 'Agent 应用框架', chips: ['Spring AI', 'LangChain4j', 'LangChain', 'LangGraph', 'SSE', 'Function Calling', 'MCP'] },
    { title: 'Agent 编排范式', chips: ['ReAct', 'Plan-and-Execute', 'Self-Reflection', 'Multi-Agent', 'A2A 协议', '长任务状态管理'] },
    { title: 'RAG 与检索', chips: ['Milvus', 'BM25 + 向量混合召回', 'Rerank', '语义缓存', 'MinerU 文档解析', '上下文压缩'] },
    { title: '后端与中间件', chips: ['Java / Spring Boot', 'MySQL', 'Redis', 'Dubbo / Nacos', 'RabbitMQ', 'Netty', '高并发治理'] },
    { title: '全栈与工程化', chips: ['Python / FastAPI', 'TypeScript / Vue', 'Dify 二开', 'Skill / SOP 提炼', 'Claude Code'] },
    { title: '模型与理论', chips: ['Prompt / Context / Harness Engineering', 'Transformer', 'KV-Cache / Prompt-Cache', 'MoE'] }
  ],
  timeline: [
    
    { icon: 'ai', date: '2025.09 - 至今', title: '某 AI 科技公司 · AI 全栈（Agent 方向）', desc: '志愿填报Agent、LLM网关' },
    { icon: 'telecom', date: '2023.03 - 2025.08', title: '某通信行业软件公司 · Java 开发 → 项目经理', desc: '哑资源管理、DAS防外破、带领6人Team' },
    { icon: 'edu', date: '2019.09 - 2023.07', title: '某红色主义大学 · 软件工程', desc: 'GPA 3.3（专业前 5%）' }
  ]
}
