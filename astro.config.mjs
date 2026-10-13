import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { SITE_URL } from './src/site.config';

// Astro 7 起默认 Markdown 处理器为 Sätteri（Rust），remark/rehype 不再默认安装。
// 本项目**刻意不装** remark/rehype：GFM 与 frontmatter 由 Sätteri 原生提供。
// 若将来确需 unified 插件，须 `npm i @astrojs/markdown-remark` 并改用 processor: unified({...})。
//
// ★ 数学公式必须显式开启。Sätteri 的 Features 里 math 的默认值是 **false**
//   （见 satteri/dist/compile.d.ts：`math?: boolean | MathOptions; // Default: false`）。
//   不开的后果不是"公式不渲染"这么温和——`$...{x}...$` 会当普通文本交给 MDX 的
//   JSX 解析，`{x}` 变成表达式 ⇒ `ReferenceError: x is not defined`，**整页构建失败**。
//   2026-10-13 实测踩到。
export default defineConfig({
  // 部署到 GitHub Pages 用户主页（仓库名 = rustin-beep.github.io）⇒ 根路径，无 base。
  // 地址取自 site.config.ts，避免第二处硬编码。
  site: SITE_URL,
  integrations: [mdx(), sitemap()],

  // ★ 正文图片的响应式 —— 只这一行，Markdown / MDX 正文里的相对图片
  //   （`![](./cover.png)`）就会：转 webp、生成 5 档 srcset + sizes。
  //   2026-10-13 实测对比（同一次构建，只差这一行）：
  //     不加 → <img src="...webp" width=800 height=400 loading="lazy" decoding="async">
  //     加了 → 上面全部 + sizes="(min-width: Npx) Npx, 100vw" + srcset="640w,750w,828w,1080w,Npx"
  //   也就是说 width/height/lazy 本来就有（Astro 默认给），
  //   **"插图没尺寸、没懒加载、是 CLS 来源"这个判断不成立**；真正缺的只是响应式多档。
  //   代价：constrained 是按**图片自身固有宽度**推 sizes 的，正文列宽只有 40rem，
  //   宽屏下会高估（浏览器可能多下一档）。手机端反而明显省流量，属可接受。
  image: { layout: 'constrained', responsiveStyles: true },
  markdown: {
    processor: satteri({ features: { math: true } }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
