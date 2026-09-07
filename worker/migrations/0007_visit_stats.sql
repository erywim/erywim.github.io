-- 访问统计：记录每次页面访问（PV），以 IP 区分访客（UV）。
-- 公开 POST /visit 写入（Origin 白名单 + 每 IP 每分钟限频）；/admin/stats/* 聚合读取。
-- visited_at 为 UTC 文本（datetime('now')），按北京时间（+8h）分日/圈「今日」。

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  path TEXT NOT NULL,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  visited_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);
CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path);
