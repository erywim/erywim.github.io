-- 内容工作区九表（设计 D2/D4）：字段镜像 src/content.config.ts 的 zod schema，
-- 统一「同步尾巴」：repo_path / repo_sha / dirty / deleted。
-- D1 是草稿区，仓库是发布区；发布前 dirty/deleted 只存在于这里。

-- 冒险记录（blog）
CREATE TABLE IF NOT EXISTS content_blog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  publish_date TEXT NOT NULL,
  updated_date TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  draft INTEGER NOT NULL DEFAULT 0,
  rank TEXT NOT NULL DEFAULT 'B' CHECK (rank IN ('S','A','B','C')),
  category TEXT NOT NULL DEFAULT '技术',
  gold INTEGER NOT NULL CHECK (gold BETWEEN 1 AND 19),
  exp INTEGER NOT NULL CHECK (exp BETWEEN 1 AND 99),
  language TEXT,
  comment INTEGER NOT NULL DEFAULT 1,
  hero_image TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_blog_date ON content_blog(publish_date);

-- 旅行日志（logs）
CREATE TABLE IF NOT EXISTS content_logs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  publish_date TEXT NOT NULL,
  week INTEGER NOT NULL,
  updated_date TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  draft INTEGER NOT NULL DEFAULT 0,
  body_md TEXT NOT NULL DEFAULT '',
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_logs_date ON content_logs(publish_date);

-- 篝火手记（chatter）
CREATE TABLE IF NOT EXISTS content_chatter (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  publish_date TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  draft INTEGER NOT NULL DEFAULT 0,
  body_md TEXT NOT NULL DEFAULT '',
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_chatter_date ON content_chatter(publish_date);

-- 道具宝箱（treasure）：icon/rarity/chest/tags 的可选值以 src/data/treasure.ts 词汇表为准，worker 侧校验兜底
CREATE TABLE IF NOT EXISTS content_treasure (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'B' CHECK (rarity IN ('S','A','B')),
  chest TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  href TEXT NOT NULL DEFAULT '',
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 灵感火花（quest）
CREATE TABLE IF NOT EXISTS content_quest (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'side' CHECK (type IN ('main','side')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','active','done')),
  diff INTEGER NOT NULL DEFAULT 2 CHECK (diff BETWEEN 1 AND 3),
  objectives TEXT NOT NULL DEFAULT '[]',
  exp INTEGER NOT NULL CHECK (exp >= 0),
  gold INTEGER NOT NULL CHECK (gold >= 0),
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 伙伴酒馆（friends）：整文件发布，sort_order 决定 friends.json 顺序
CREATE TABLE IF NOT EXISTS content_friends (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 旅程大事记（timeline）：整文件发布，sort_order = 数组顺序（最新在前）
CREATE TABLE IF NOT EXISTS content_timeline (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 首页存档（party/home.json）：整文件发布
CREATE TABLE IF NOT EXISTS content_party (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT 'mage' CHECK (avatar IN ('warrior','mage')),
  chips TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 勇者档案（hero）：单行（id 固定 'default'），嵌套结构存 JSON 列
CREATE TABLE IF NOT EXISTS content_hero (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  stats TEXT NOT NULL DEFAULT '{}',
  skills TEXT NOT NULL DEFAULT '[]',
  timeline TEXT NOT NULL DEFAULT '[]',
  buffs TEXT NOT NULL DEFAULT '[]',
  contacts TEXT NOT NULL DEFAULT '[]',
  repo_path TEXT NOT NULL,
  repo_sha TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
