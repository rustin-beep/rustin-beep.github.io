import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 6 起 zod 从 astro/zod 导入（Zod 4）。旧教程写 astro:content 会失败。
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/posts' }),
  /**
   * ★ Astro 7 起 schema 可以是**函数**，`image()` 由上下文注入。
   *
   * 依据（实测源码，2026-10-13）：`astro/dist/content/config.d.ts` 里
   *   `schema?: S | ((context: SchemaContext) => S)`，而
   *   `SchemaContext = { image: ImageFunction }`。
   * 同时 `astro:assets` 的导出只剩 getImage / imageConfig / Image / Picture / Font…
   * —— **没有 image()**。所以旧教程那行 `import { image } from 'astro:assets'`
   * 在 Astro 7 上是错的，必须写成下面的解构参数形式。
   */
  schema: ({ image }) =>
    z.object({
      // max 让过长的 SEO 标题变成构建失败，而不是上线后才发现
      title: z.string().max(60),
      description: z.string().max(160),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),

      /**
       * ★ 归档不在这里 —— 见文件末尾的「归档 = 放进 archive/ 目录」。
       *   这里刻意**没有** archived 字段：位置即状态，不留两套真相。
       */

      /**
       * 封面图：**相对本文件的路径**（如 './cover.png'）。
       * 由 Astro 图片管线处理（转 webp、带宽高防 CLS、按 layout 生成 srcset），
       * 渲染在文章页标题上方。缺省不显示。
       */
      cover: image().optional(),
      coverAlt: z.string().optional(),

      // slug 显式：URL 与文件名解耦——改标题不动已发布的地址。
      // 缺省回退到**文件名**（不含目录，见 lib/posts.ts 的 postSlug）。
      slug: z
        .string()
        .regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/, 'slug 只能含小写字母/数字/连字符/斜杠')
        .optional(),
    })
    /**
     * ★ .strict()：**多写一个字段就构建失败**，而不是静默忽略。
     *
     * 为什么值得这么严：归档改成了"按目录"，于是 frontmatter 里再写
     * `archived: true` 就是一个**不会生效的谎**——作者以为归档了，其实没有。
     * Zod 默认会把未知键悄悄 strip 掉，这正是本项目最不想要的失败方式
     * （构建绿、行为错）。顺带也把 `date:` / `pubdate:` 这类改名笔误变成红。
     */
    .strict(),
});

/**
 * 「归档」= **把文件放进 `src/content/posts/archive/`**（2026-10-13 用户定案）
 * ----------------------------------------------------------------------------
 * 原先默认做法是 frontmatter 里写 `archived: true`。用户否掉了这个方向：
 * 归档是**文件位置**的问题，不是每篇都要手写一个字段——搬进 `archive/`
 * 就该自动算归档，而手写标记既容易漏、也容易与目录现状不一致。
 *
 * 语义与 draft 严格区分（别混）：
 *   draft      = **不存在**。不进任何产物、不进 sitemap、不进 RSS、不进搜索索引。
 *   archive/   = **存在但退场**。页面 / RSS / sitemap / 搜索索引**全部保留**
 *                （旧链接不许 404），只是：首页"最新文章"不再列它、
 *                归档页单独分组、文章页顶部打"已归档"横幅、llms.txt 打标。
 *
 * ★ 目录**不进 URL**：`archive/foo.mdx` 的地址仍是 `/posts/foo/`
 *   （postSlug 只取文件名、不取目录）⇒ **搬进归档不会烂掉任何外链**。
 *   这是选这条机制的关键理由。要嵌套路径就必须写显式 slug。
 * ★ 判据是路径里有没有名为 `archive` 的那一段，所以 `archive/2024/foo.mdx`
 *   也算归档。
 * ★ 配套守卫：文件层级被拍平后必须防 slug 重名，
 *   所以 lib/posts.ts 里有一条 fail-loud 的 slug 去重。
 */

export const collections = { posts };
