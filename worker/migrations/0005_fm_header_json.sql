-- 补齐 json 域四表的 fm_header（upsertRow 统一写入该列；json 文件无 frontmatter，恒为 NULL）
ALTER TABLE content_friends ADD COLUMN fm_header TEXT;
ALTER TABLE content_timeline ADD COLUMN fm_header TEXT;
ALTER TABLE content_party ADD COLUMN fm_header TEXT;
ALTER TABLE content_hero ADD COLUMN fm_header TEXT;
