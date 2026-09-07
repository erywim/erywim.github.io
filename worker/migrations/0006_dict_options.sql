-- 字典表：后台下拉框选项的单一来源（按 category 分组）。
-- 注意：这里只驱动 UI 展示；服务端校验仍以 worker/src/lib/domains.ts 的枚举为准，
-- 词汇语义（icon 对应 SVG sprite、chest 对应 src/data/treasure.ts）与站点代码耦合，增删需同步代码。

CREATE TABLE IF NOT EXISTS dict_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(category, value)
);

INSERT OR IGNORE INTO dict_options (category, value, label, sort_order) VALUES
  -- blog.rank 难度
  ('blog.rank', 'S', 'S · 硬核', 1),
  ('blog.rank', 'A', 'A · 进阶', 2),
  ('blog.rank', 'B', 'B · 标准', 3),
  ('blog.rank', 'C', 'C · 轻松', 4),
  -- blog.category 地图
  ('blog.category', '技术', '技术', 1),
  ('blog.category', '产品', '产品', 2),
  ('blog.category', '生活', '生活', 3),
  ('blog.category', '笔记', '笔记', 4),
  -- treasure.icon 图标
  ('treasure.icon', 'it-scroll', '卷轴', 1),
  ('treasure.icon', 'it-book', '书本', 2),
  ('treasure.icon', 'it-paper', '文档', 3),
  ('treasure.icon', 'it-video', '视频', 4),
  ('treasure.icon', 'it-gear', '齿轮', 5),
  ('treasure.icon', 'it-crystal', '水晶', 6),
  ('treasure.icon', 'it-chip', '芯片', 7),
  ('treasure.icon', 'it-graph', '图谱', 8),
  ('treasure.icon', 'it-box', '宝箱', 9),
  -- treasure.rarity 稀有度
  ('treasure.rarity', 'S', 'S 级', 1),
  ('treasure.rarity', 'A', 'A 级', 2),
  ('treasure.rarity', 'B', 'B 级', 3),
  -- treasure.chest 主题宝箱
  ('treasure.chest', 'java', 'Java', 1),
  ('treasure.chest', 'python', 'Python', 2),
  ('treasure.chest', 'agent', 'Agent', 3),
  ('treasure.chest', 'deep-learning', '深度学习', 4),
  ('treasure.chest', 'rag', 'RAG', 5),
  ('treasure.chest', 'system-design', '系统设计', 6),
  ('treasure.chest', 'frontend', '前端', 7),
  -- treasure.tag 标签（name 与 src/data/treasure.ts 对齐）
  ('treasure.tag', 'java', 'Java', 1),
  ('treasure.tag', 'python', 'Python', 2),
  ('treasure.tag', 'frontend', '前端', 3),
  ('treasure.tag', 'agent', 'Agent', 4),
  ('treasure.tag', 'llm', '大模型', 5),
  ('treasure.tag', 'rag', 'RAG', 6),
  ('treasure.tag', 'deeplearning', '深度学习', 7),
  ('treasure.tag', 'database', '数据库', 8),
  ('treasure.tag', 'system-design', '系统设计', 9),
  ('treasure.tag', 'article', '文章', 10),
  ('treasure.tag', 'paper', '论文', 11),
  ('treasure.tag', 'video', '视频', 12),
  ('treasure.tag', 'tutorial', '教程', 13),
  ('treasure.tag', 'tool', '工具', 14),
  ('treasure.tag', 'repo', '仓库', 15),
  ('treasure.tag', 'asset', '素材', 16),
  ('treasure.tag', 'dataset', '数据集', 17),
  ('treasure.tag', 'interview', '面试', 18),
  ('treasure.tag', 'practice', '实践', 19),
  ('treasure.tag', 'performance', '性能', 20),
  ('treasure.tag', 'architecture', '架构', 21),
  ('treasure.tag', 'principle', '原理', 22),
  ('treasure.tag', 'todo', '待办', 23),
  ('treasure.tag', 'read', '精读', 24),
  ('treasure.tag', 'verified', '已验证', 25),
  ('treasure.tag', 'inspiration', '灵感', 26),
  -- quest.type / quest.status
  ('quest.type', 'main', '主线', 1),
  ('quest.type', 'side', '支线', 2),
  ('quest.status', 'todo', '未开始', 1),
  ('quest.status', 'active', '进行中', 2),
  ('quest.status', 'done', '已完成', 3),
  -- party.avatar
  ('party.avatar', 'mage', '法师', 1),
  ('party.avatar', 'warrior', '战士', 2);
