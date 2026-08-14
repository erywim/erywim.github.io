import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

import { CHEST_IDS, ICONS, RARITIES, TAG_IDS } from '@/data/treasure'
import { STATUS_IDS, TYPE_IDS } from '@/data/quest'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),

          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // Special fields
      comment: z.boolean().default(true),
      // Famicom RPG theme fields
      /** 任务难度：S / A / B / C，缺省 B */
      rank: z.enum(['S', 'A', 'B', 'C']).default('B'),
      /** 地图「技术 / 产品 / 生活 / 笔记」，缺省 技术 */
      category: z.string().default('技术'),
      /** 每篇任务可获金币（1~19，创建时随机生成） */
      gold: z.number().int().min(1).max(19),
      /** 每篇任务可获经验（1~99，创建时随机生成） */
      exp: z.number().int().min(1).max(99)
    })
})

// Define logs collection (weekly travel logs)
const logs = defineCollection({
  loader: glob({ base: './src/content/logs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      /** 第 N 周 */
      week: z.number(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      draft: z.boolean().default(false)
    })
})

// Define treasure collection (collected materials / 道具宝箱)
const treasure = defineCollection({
  loader: glob({ base: './src/content/treasure', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      /** 像素图标（可选值见 src/data/treasure.ts 的 ICONS） */
      icon: z.enum(ICONS),
      /** 稀有度 S / A / B，缺省 B */
      rarity: z.enum(RARITIES).default('B'),
      /** 主题宝箱 id（可选值见 CHEST_IDS，不含「全部 all」） */
      chest: z.enum(CHEST_IDS),
      /** 来源，如 spring.io / 待读；留空则不显示 */
      from: z.string().default(''),
      title: z.string().max(120),
      /** 一句话简介 */
      desc: z.string().default(''),
      /** 标签 id（可选值见 TAG_IDS，可跨主题多个） */
      tags: z.array(z.enum(TAG_IDS)).default([]),
      /** 跳转链接；留空则渲染为「待读」不可点 */
      href: z.string().default('')
    })
})

// Define quest collection (idea / todo 灵感火花)
const quest = defineCollection({
  loader: glob({ base: './src/content/quest', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string().max(120),
      /** 一句话描述 */
      desc: z.string().default(''),
      /** main 主线 / side 支线 */
      type: z.enum(TYPE_IDS).default('side'),
      /** todo 未开始 / active 进行中 / done 已完成 */
      status: z.enum(STATUS_IDS).default('todo'),
      /** 难度 1~3 星 */
      diff: z.number().int().min(1).max(3).default(2),
      /** 目标清单（只读，勾选态靠改 done） */
      objectives: z
        .array(z.object({ t: z.string(), done: z.boolean().default(false) }))
        .default([]),
      /** 奖励经验（完成后计入全局等级） */
      exp: z.number().int().min(0),
      /** 奖励金币（完成后计入全局金币） */
      gold: z.number().int().min(0)
    })
})

export const collections = { blog, logs, treasure, quest }
