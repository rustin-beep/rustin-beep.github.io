# 博客

Astro + MDX 的静态博客。**默认零运行时框架**，正文只有约 1 KB 内联 JS
（主题切换 + 代码复制按钮）。

## 命令

```bash
npm install          # 首次
npm run dev          # 本地开发 http://localhost:4321
npm run build        # 构建 + Pagefind 索引
npm run preview      # 预览构建产物
npm run check        # astro check（类型）
npm run contrast     # 对比度审计（零依赖）
npm run gate         # check + contrast + build
```

## 环境要求

Node ≥ 22.12.0、npm ≥ 9.6.5（Astro 7 的硬要求）。

## 纪律

1. **颜色字面量只允许出现在 `src/styles/tokens.css`**，且必须是
   `light-dark(浅色, 深色)` 双值形态。别处一律 `var(--...)`。
   违反会被 `npm run contrast` 判红。
2. **对比度不足要有兜底说明**——在 `scripts/check-contrast.mjs` 的检查表里
   给该对补 `exempt` 理由，不许静默放行。
3. **站点身份只在 `src/site.config.ts` 定义**——名字、头像、GitHub 地址。
   改 `GITHUB_HANDLE` 即整体换名；头像取 GitHub 直链，**换头像即换站内 logo**。
4. **`site` 字段由 `src/site.config.ts` 的 `SITE_URL` 提供**（当前
   `https://<user>.github.io`），影响 sitemap 与 RSS 的绝对地址。换域名只改那一行。
5. **文章标题从 `##` 起**，不要用 `#`——否则单篇出现多个 h1。
6. **构建前先停掉 `astro preview`**，否则会 `EBUSY: rmdir dist/.prerender/chunks`。
7. **字体只有一款自托管**：代码块用的 JetBrains Mono latin 子集
   （`public/fonts/`，21 KB，OFL-1.1）。**不要改用 Google Fonts CDN**——
   `fonts.gstatic.com` 在中国大陆经常不可达。正文仍是系统字体、不下载任何东西。
8. **字号用 `clamp(rem, rem+vw, rem)`，不要改回固定 rem**——固定值会让手机与桌面
   用同一个物理字号。`clamp` 里 rem 那一半负责"跟随浏览器字号设置"，
   `vw` 那一半负责"跟随屏幕宽度"。
9. **新增文章无需手动登记任何索引**：`/llms.txt` 与 `/posts/<slug>.md`
   都从内容集合实时生成，另有 JSON-LD 与 `rel=canonical`。字数与阅读时间也从
   正文现算，**不要写进 frontmatter**。
10. **`--font-mono` 里拉丁等宽之后必须显式接 CJK 无衬线**
    （`'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC'`）。
    JetBrains Mono 的 latin 子集不含汉字，回退项若只写等宽 CJK，用户机器上没装时
    浏览器会静默滑到 generic `monospace`。
11. **`.astro-code code { font-family: inherit; }` 不能删。** UA 样式表给 `code`
    单独设了 `font-family: monospace` 且**不继承 `pre`**——少了这条，代码块里的文字
    会退回系统等宽（Windows 上可能是带衬线的 Courier New），而行内代码仍是对的，
    表现就是"代码框和正文不是一种字体"。**验证时量 `<code>`，别量 `pre`。**

## 面向 AI / 抓取

| 路径 | 内容 |
|---|---|
| `/llms.txt` | 全站索引（llmstxt.org 约定）：每篇标题 / URL / 摘要 + 原始 Markdown 直链 |
| `/posts/<slug>.md` | 文章**原始 Markdown**，含 minimal frontmatter 与 canonical |
| `/rss.xml` | 订阅源 |
| `/sitemap-index.xml` | 站点地图 |
| `/robots.txt` | 爬虫规则 |

文章页 `<head>` 另有 `schema.org BlogPosting` 的 JSON-LD，无需从正文推断元数据。

## 部署

推送到 `main` 即自动发布：`.github/workflows/deploy.yml`
（`withastro/action@v6` → `actions/deploy-pages@v5`）。
线上地址 <https://rustin-beep.github.io/>。

CI 跑的就是本地的 `npm run build`，所以**搜索索引在 CI 里一并产出**，无需额外步骤。
Pages 的发布方式必须是 **Actions**（`build_type: workflow`），不是"从分支发布"。

## 文档

- [`PLAN.md`](./PLAN.md) —— 方案、版本基线、踩坑记录、挂起项
