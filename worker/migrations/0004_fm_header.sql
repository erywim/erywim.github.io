-- 文件注释头原文（quest/treasure/chatter 等文件 frontmatter 顶部的 # 注释块逐文件不同，
-- 解析时捕获原文存此列，发布时原样回放，保证 round-trip 逐字节一致；NULL = 无注释头）
ALTER TABLE content_blog ADD COLUMN fm_header TEXT;
ALTER TABLE content_logs ADD COLUMN fm_header TEXT;
ALTER TABLE content_chatter ADD COLUMN fm_header TEXT;
ALTER TABLE content_treasure ADD COLUMN fm_header TEXT;
ALTER TABLE content_quest ADD COLUMN fm_header TEXT;
