# 博客方案 —— Astro + MDX

> 阶段一定稿：**只做博客本体**。引擎嵌入（Vitro 内可运行 C 代码）整体挂起，
> 归为后续的「后端接入」阶段——本方案只为那个阶段预留接口位，不预先实现。

## 一、锁定范围

**做**：内容集合与路由、排版与设计令牌、明暗双主题、代码高亮与复制、标签/归档、
RSS/sitemap、构建期校验与对比度审计、静态部署。

**不做**：Vitro 嵌入、评论系统、CMS、i18n、客户端路由、UI 组件库、web font。

## 二、版本基线（实测，非二手）

| 包 | 版本 | 约束 |
|---|---|---|
| `astro` | 7.3.8 | Node ≥ 22.12.0、npm ≥ 9.6.5 |
| `@astrojs/mdx` | 8.0.3 | peer `astro ^7.2.10` |

> 这两行是查 npm registry 得到的。Astro 两年内换了三代，**任何教程照着做之前
> 先确认它写的是哪个版本**——本文件同样只对上述版本负责。

## 三、最大的一条：Markdown 管线换代

Astro 7.0 起，默认 Markdown 处理器从 remark/rehype 换成自研的 **Sätteri**
（Rust：pulldown-cmark 解析 + Oxc 处理 MDX 表达式），官方口径构建快 15–61%。

- remark/rehype **不再默认安装**，标准 remark/rehype 包与 Sätteri**不兼容**。
- 要保留旧管线须 `npm i @astrojs/markdown-remark` 并写
  `markdown.processor: unified({ remarkPlugins, rehypePlugins })`。
- 顶层 `markdown.remarkPlugins / rehypePlugins / gfm / smartypants` 已标废弃。
- **本项目的取舍：一个 remark/rehype 插件都不装。** Sätteri 原生支持
  GFM / frontmatter；**数学公式除外**——它的 math 默认关闭且只管标记不管排版，
  详见 §六之三。

## 四、架构：构建期与运行时的分界

```
构建期（Node 里跑完即消失，不进浏览器）
  ├─ MDX/Markdown → HTML
  ├─ Shiki 双主题语法高亮
  ├─ Zod 校验 frontmatter（写错就构建红）
  ├─ 生成 标签页 / 归档 / RSS / sitemap
  └─ Pagefind 建索引

运行时（浏览器实际收到）
  ├─ HTML + CSS（约十几 KB gzip）
  ├─ 字体 0 KB（中文一律系统字体栈）
  ├─ JS 1.2–2.4 KB 内联（外链 JS 恒为 0）
  └─ 搜索索引：只有打开搜索框才拉
```

## 五、目录结构

```
blog/
├── astro.config.mjs
├── src/
│   ├── site.config.ts             # 站点身份单源（名字 / 头像 / GitHub）
│   ├── content.config.ts          # 集合 schema（注意：不在 src/content/ 里）
│   ├── content/posts/*.mdx
│   ├── layouts/{BaseLayout,PostLayout}.astro
│   ├── components/{Callout,PostCard,TagList}.astro
│   ├── pages/
│   │   ├── index.astro · about.astro · archive.astro · 404.astro
│   │   ├── posts/[...slug].astro
│   │   ├── tags/index.astro · tags/[tag].astro
│   │   └── rss.xml.ts
│   └── styles/tokens.css          # 设计令牌单源
├── scripts/check-contrast.mjs     # 对比度审计（零依赖）
└── public/favicon.svg
```

## 六、已拍板的决定

1. **slug 显式**。frontmatter 写 `slug`，缺省回退 id（文件名）。URL 与文件名解耦——
   改标题不动已发布的地址。
2. **要代码复制按钮**。用一段内联脚本渲染后统一注入到每个 `pre.astro-code`，
   不引入框架。代价是「正文页 0 JS」不严格成立，实际约 1 KB——如实标注。
3. **不用 rehype-slug**。Astro 内置 `rehypeHeadingIds` 已生成 id 并填好 `headings`
   数组；叠加会出现两套 id 体系、目录锚点对不上。
4. **色系只上"四周与按键"，绝不进入文章主体**。令牌分两组，色温物理隔离：
   `chrome-*`（**混凝土冷灰 + 锈**，用于页面底/页头页脚/按钮/标签/边框）与
   `surface-*`（**中性、禁带暖色**，用于文章正文与代码块）。
   视觉结果是"废墟里的一张白纸"，而非在一片底色上混两种色温。
5. **正文区必须是独立的中性面**（浅色 `#ffffff` / 深色 `#1b1b1b`），
   靠边框而非色差与暖底分离。
6. **重音 = 铁锈**（`#7d3517` / `#d07a33`）。最初取《庶子》的"褪色的红"
   （红头绳），但那个红太柔、撑不住"废墟"；改为此橙棕向的真锈色。
7. **代码高亮不自建主题**——正文区已是中性面，现成主题的彩色不会污染暖调；
   `markdown.shikiConfig` 用 `github-light` / `github-dark`。
8. **无衬线正文 + 等宽代码**。正文纯系统字体、不下载任何东西；
   **代码块用自托管 JetBrains Mono**（latin 子集 21.2 KB），见 §六之五。
   不做文学轨，全站一套。

## 六之二、配色定调（2026-10-13 定案）

定调**取自用户自己的作品**，不是凭空选的：《庶子修缮版》（约 4 万字）全篇贯穿着
一套"褪色物"色语——铁盒的锈分六层、奖状纸面发黄、红头绳褪得发白、青砖、白霉、
煤油灯的暗黄。**没有一处是饱和或明亮的，全是氧化色**。据此得到三件事：

| 维度 | 结论 |
|---|---|
| **浅色 = 灰砖** | **青砖冷灰**：底 `#d3d9df`、按钮底 `#c2c9d1`、砖缝 `#98a2ad`、文字 `#1a1f26` |
| **深色 = 铁锈** | **暖棕锈**：底 `#1a1410`、按钮底 `#33271d`、锈边 `#6b503a`、文字 `#ece2da` |
| 文章主体 | **中性**，不染色（`#ffffff` / `#1b1b1b`）。用户明确要求，也顺带保护了语法着色的干净 |
| 重音 | **铁锈** `#7d3517` / `#d9823c`——两套主题共用的唯一暖色 |
| 结构线 | 页头页脚分界线 **2px 锈色**；青砖（冷）与锈（暖）的对冲就落在这条线上 |

**明暗两套刻意走不同色温**（2026-10-13 用户拍板）：浅色＝青砖的白天，深色＝锈与煤油灯的夜。
翻转主题＝翻转色温。两套分别都成立，不是同一套色值的深浅变体。

**★ 走过的弯路（记下来免得再犯）**：
1. 第一版把整体做成**暖灰褐**（`#f4f0e8`）——被判"太秀气，不是废墟的锈气"。
   根因不是色号不够深，而是**配色逻辑反了**：底和锈都暖 ⇒ 没有对冲。
2. 第二版改成**冷灰混凝土底 + 锈**，锈气出来了，但用户要的是更具体的两个意象。
3. 第三版（定案）按用户指定：**浅色用灰砖、深色用铁锈**。
   两版都保留了关键一条——**底为冷/中性，暖色只由重音（锈）提供**。
4. 结构同批调整（"秀气"不只靠颜色治）：`--radius` 10px → **2px**；页头页脚分界线 1px → **2px**。

### 视觉自审（交用户前必做）

改样式后**先自己截图看渲染**再交，不靠脑测。可复现的做法：

```bash
# 1. 造浅/深两版临时页（无头浏览器读不到 localStorage，故把主题硬编码）
#    把 dist/index.html 里的 localStorage.getItem('theme') 替换成 'light' / 'dark'
# 2. 起静态服务：npx astro preview --port 4400
# 3. 截图：
#    msedge --headless=new --disable-gpu --hide-scrollbars \
#      --user-data-dir=<临时目录> --window-size=1280,1150 \
#      --screenshot=out.png "http://127.0.0.1:4400/__shot_index_light.html"
```

截图快照留在 `preview/`（index / post × 浅色 / 深色）。**样式改了要重新生成**。

### 自审发现并修掉的问题（都是第一版就有的）

1. `main` 上的 `min-height: 60vh` 让"白纸"拖出一大片空白 → 删除。
2. `.container-wide` 定 52rem，正文实际跑到约 46rem、比 `--measure` 宽 → 改 45rem，
   减去 `main` 内边距后恰好 ≈ 40rem。
3. 浅色代码块底 `#f7f7f7` 贴白、几乎看不出块 → 降到 `#f2f2f2` 并加 1px 描边。
4. **代码块没有任何可见的语言标注**（只有 `data-language` 属性）→ 加机框与标签，见下。
5. 配色逻辑反了（暖底 + 暖锈）→ 改冷灰混凝土底 + 锈，见上。

### 代码块机框与语言标注

结构由 `PostLayout` 的内联脚本在渲染后包一层：

```
figure.code-figure
  ├─ div.code-bar    ← 左：语言标注；右：复制按钮
  └─ pre.astro-code  ← Shiki 输出（自带 data-language）
```

**为什么用脚本改结构而不是构建期**：Astro 7 的 Markdown 管线是 Sätteri，
没有现成的 remark/rehype 可挂（见 §三），为一个装饰件引入 hast 插件不划算。
代价是标签需要 JS——与复制按钮同一条边界。

**实测结论：Astro 7 会把围栏的 meta 丢掉。** 写 ```` ```c title="main.c" ````
之后，产物里**只有 `data-language="c"`，既无 `data-meta` 也无 `title` 属性**。
所以**文件名标不了**，只能标语言；要标文件名得自己写 Sätteri 的 hast 插件。

### 存疑（留记录）

- 深色下严格中性的面板相对烟熏底仍略偏冷，但差异比暖底方案小得多，暂不改。
- 真正的"废墟"还需要**材质感**（噪声/斑驳）。当前只用颜色与结构表达，
  没有引入纹理渐变——那属于装饰，等确认要了再加。

## 六之三、数学公式（2026-10-13 实测）

**结论：Astro 7 上 LaTeX「不能开箱正常加载」。** 三层事实：

1. Sätteri 的 math **默认关**（源码：`satteri/dist/compile.d.ts` → `math?: boolean | MathOptions; // Default: false`）。
2. 不开的后果是**构建失败**，不是退化显示。
3. 开启后 Sätteri 只做**识别与标记**（`code.language-math`），**排版不在它手里**。

**所以"Sätteri 原生支持数学公式"这个说法要打折**：准确说是原生支持数学的*识别*，
不支持数学的*排版*。之前 §三 与本文件里那句"数学公式由 Sätteri 原生提供"**已据此更正**。

**渲染器的两条路，成本差很远**：

| 方案 | 运行时成本 | 说明 |
|---|---|---|
| KaTeX `output: 'mathml'` | **零**（无 CSS、无字体） | 浏览器原生排 MathML；Chrome 109+ / Safari / Firefox 支持 |
| KaTeX `output: 'html'` | CSS ~23 KB + 整套数学字体 | 排版最精细，但违背"不用 webfont"的既定决定 |

对本站（全站 CSS 8 KB、明令不用 webfont）前者更合身。**接入方式**：`defineHastPlugin`
在构建期把 `code.language-math` 换成渲染结果，运行时仍零 JS。

> **当前状态：未接渲染器。** 配置里已开 `features.math`（避免整页构建失败），
> 但公式目前以原始 LaTeX 文本呈现。待用户拍板后实施。

## 六之四、站点身份（单一来源，2026-10-13）

全部集中在一个文件 `src/site.config.ts`：显示名、GitHub 用户名、主页地址、头像直链。
页头、页脚、关于页、RSS 都从这里取，**不存在第二处硬编码**。

- **名字**：显示名 `不吃谢谢`（GitHub 昵称）+ `@rustin-beep`（用户名，页头小号字）。
  窄屏（≤48rem）优先隐藏 `@handle`——它是页头里信息量最低的一项。
- **头像即 logo**：`<link rel="icon">`、`apple-touch-icon`、页头小圆头像、关于页大圆头像
  全部指向 GitHub 直链 `https://github.com/<user>.png?size=N`（实测 302 到
  `avatars.githubusercontent.com`）。**所以在 GitHub 换头像，站点 logo 跟着换**；
  改用户名只需改 `GITHUB_HANDLE` 一行。
- **GitHub 地址**：页头导航外部项、页脚、关于页各有入口，并带
  `<link rel="me" href="...">` 声明同一身份。
- `public/favicon.svg`（先前自造的字母标记）**已删**，避免两处 logo 并存。

### 一条要提前说的代价

头像是一幅**线描**。在 28px（页头）尚可，**到 16px 的 favicon 尺寸会糊成一团**——
这是图像的固有属性，不是实现问题。若在意浏览器标签页的辨识度，
可以另做一枚简化的 16px SVG 图标只在 favicon 位用，其余位置继续用头像。
**当前未做**（用户明确要求 logo 跟随头像）。

## 六之五、代码字体（2026-10-13 接入）

**正文仍是系统字体、不下载任何东西；只有代码块加载一款自托管等宽字体。**

- **字体**：JetBrains Mono，**只取 latin 子集**，**21,168 字节**
  （sha256 `14425ba9c695763c1547f48a206b7aa60350a33ae23de09f0407877f3fcd89eb`）。
  落在 `public/fonts/jetbrains-mono-latin.woff2`；许可是 OFL-1.1，
  全文随包 `public/fonts/OFL.txt`。
- **只取 400 单字重**：已对构建产物核验，Shiki 的 `github-light` / `github-dark`
  主题**只用 `color`，不用 `font-weight` 也不用 `font-style`** ⇒ 无需 700，
  于是拿 21.2 KB 的单字重而非 31.4 KB 的可变字体，省约 10 KB。
- **只 preload 文章页**：首页/归档/标签页没有代码块，不该白下载这 21 KB。
  实现：`BaseLayout` 开一个 `<slot name="head" />`，`PostLayout` 往里放
  `<link rel="preload" as="font" … crossorigin>`。
  **`crossorigin` 是必需项**——字体按 CORS 取，缺了它 preload 与真实请求对不上，
  会重复下载。
- **`font-display: swap`**：先显示回退字体、到位后替换，不出现隐形文字。
- **`unicode-range` 挡 CJK**：中文在代码块里照样走系统回退。CJK 等宽字体动辄
  数 MB，与"不下载中文 webfont"的决定冲突；`unicode-range` 让浏览器**连尝试都
  不尝试**，省掉一次注定失败的字体查询。
- **★ 不走 CDN**：`fonts.gstatic.com` 在中国大陆经常不可达，必须下载自托管。

### 为什么这次不算"破例下载 webfont"

之前那条纪律针对的是**中文**字体（数 MB 量级）。编码字体只需 latin 子集，
**21 KB 与全站 CSS（8 KB）同一量级**——不是同一类东西。

### ★★ 真根因：UA 样式表给 `code` 单设了 `font-family: monospace`（2026-10-13）

**症状**：用户报"代码框里的还是系统字体，外部的不是"、"代码框里的和正文的就不是一种
字体，你看 `@` 就可以分辨出来了"。

**我第一轮判断错了**：我量了 `pre` 的 computed `font-family`，看到
`"JetBrains Mono"` 就下结论"字体一直生效、问题在中文回退"。**那是测错了元素**——
文字不在 `pre` 上，在它内部的 `<code>` 里。用户第二次反馈后做了四元素实测才定位：

| 元素 | 修复前 | 修复后 |
|---|---|---|
| `pre.astro-code` | `"JetBrains Mono", …` ✓ | 同 |
| **`pre > code`** | **`monospace`** ✗ | `"JetBrains Mono", …` ✓ |
| `pre > code > span` | `monospace` ✗ | `"JetBrains Mono", …` ✓ |
| `.prose code:not(pre code)` | `"JetBrains Mono", …` ✓ | 同 |

**根因**：Shiki 输出 `<pre class="astro-code"><code>…</code></pre>`，而
**浏览器 UA 样式表给 `code` 单独设了 `font-family: monospace`，它不继承 `pre`**。
只把 `--font-mono` 写在 `.astro-code`（`pre`）上，字体根本落不到装文字的 `<code>`，
文字实际渲染成 generic `monospace`——Windows 上可能是 **Courier New 这类带衬线的
等宽**，所以用户看到的是"衬线感"的系统字体。行内代码因为
`.prose code:not(pre code)` 显式设过，反而是对的 ⇒ 两者不同族。

**修法**：`.astro-code code { font-family: inherit; }`（一行，但删了代码块就退回系统字体）。

**教训（比这个 bug 本身重要）**：
- **"看到 computed style 是想要的字体"不等于"文字用的就是这个字体"**——
  必须量**真正装文字的那层元素**。
- UA 样式表会**阻断继承**：给容器设 `font-family` 时，容器内若有 `code` / `pre` /
  `textarea` / `input` 等被 UA 设过字体的元素，**必须单独覆盖**。
- 用户说"看起来不对"时，先怀疑自己的验证方法，别急着解释成用户对现象的误读。

### 附带修正：CJK 回退项（同一轮发现，独立成立）

排掉根因后顺带确认了另一件事，**它本身是对的、也保留**：mono 栈里的 CJK 回退
原来只写了 `'Noto Sans Mono CJK SC'` → `monospace`，用户机器上没装时浏览器会静默
滑到 generic `monospace`。现已显式接上 `--font-sans` 同一套无衬线，
代码注释里的中文与正文同族。

> **教训**：字体栈里的 CJK 回退项不能随手写。写了等宽 CJK 而用户没装，
> 浏览器就静默滑到 generic，结果逐机器不一致——**这正是"我这边看着对、
> 你那边看着错"的来源**。

### 一条要提前知道的默认行为

JetBrains Mono **默认开启连字**（`calt`）：`->` 显示成 `→`、`!=` 显示成 `≠`、
`>=` 显示成 `≥`。这是该字体的设计，多数编辑器也如此。若觉得在代码里会误读，
在 `.astro-code` 加一行 `font-variant-ligatures: none` 即可关掉。

### 候选字体体积（实测，供将来换用）

| 字体 | latin woff2 |
|---|---|
| Red Hat Mono | 9.7 KB |
| Geist Mono | 9.9 KB |
| Source Code Pro | 11.7 KB |
| IBM Plex Mono | 14.7 KB |
| **JetBrains Mono** | **21.2 KB** |
| Fira Code | 23.3 KB |

> 顺带记录：**Vitro 仓库里没有任何字体文件**，其 `demo/tokens.css` 用的是系统栈
> `ui-monospace, "Cascadia Code", Consolas, "Microsoft YaHei UI"`。

## 六之六、流式字号（2026-10-13）

字号阶梯从固定 rem 改成 `clamp(min, preferred, max)`，**两个自变量同时生效**：

- `min` / `max` 用 **rem** ⇒ 仍随**浏览器默认字号**缩放（用户调大字号，全站跟着大）
- `preferred` 里的 **`vw`** ⇒ 随**视口宽度**变化（手机小、桌面大）

实测（截图留 `preview/fluid-*.png`）：375px 手机 → 正文 16px；1440px 桌面 → 17px；
再叠加"用户默认字号调到 24px"仍**整体等比放大**——两件事不互斥，`clamp` 里 rem 那一半
保证了后者。

**纪律：不要改回固定 rem。** 固定 rem 会让手机与桌面用同一个物理字号，
窄屏下不缩、宽屏下不增。

## 六之七、面向 AI 的文章设计（2026-10-13）

目标：让 agent / LLM 用**最省事**的方式拿到一篇的纯文本与元数据，
不必走"抓 HTML → 去标签 → 猜哪块是正文 → 去导航"这一整套。

四件产物，**全部从内容集合实时生成**（不存在"忘了更新"的第二真相源）：

| 产物 | 路径 | 作用 |
|---|---|---|
| `llms.txt` | `/llms.txt` | 按 llmstxt.org 约定生成的全站索引：每篇标题 / URL / 摘要 + 原始 Markdown 直链 |
| 原始 Markdown | `/posts/<slug>.md` | 文章纯 Markdown，头部补最小 frontmatter（标题/日期/标签/**canonical**） |
| JSON-LD | 文章页 `<head>` | `schema.org BlogPosting`：标题/日期/作者/标签，不必从正文猜 |
| head 级指针 | 站点 `<head>` | `<link rel="canonical">`、`<link rel="alternate" type="text/plain" href="/llms.txt">`、`rel="me"` |

`robots.txt` 里指向 sitemap 并提及 llms.txt——但**那只是注释、不是可执行指令**，
所以另加了 head 级 `alternate` link 作为机器可读的发现路径。

**新增的两条坑**（都被门禁抓到，见 §七 表 12/13）：
`post.body` 会把 MDX 的 `import X from '…'` 带进 Markdown；以及新端点文件必须过
`astro check`。

## 六之八、阅读统计与分享卡片（2026-10-13）

- **字数与阅读时间**：`src/lib/reading-time.ts` 从 `post.body` **现算**，不写进
  frontmatter——手写必然出现"忘了改"的第二真相源。文章元信息行显示
  `2026/10/12 · 409 字 · 约 2 分钟`。
  **刻意排除代码块与行内代码**：代码是"看"不是"读"，把 `=>`、`nullptr`、大括号
  都算进字数会显著虚高。代价是纯代码长文会低估，技术博客里这个取舍更划算。
  速率取中文 400 字/分、英文 250 词/分。
- **Open Graph / Twitter Card**：此前**完全没有**，链接分享出去是一条裸 URL。
  现在 `og:type/title/description/url/image/locale` + `twitter:card` 齐了。
  `og:image` 直接用头像直链——**是正方形、不是 OG 推荐的 1200×630**，
  属"有比没有强"。要更正式须为每篇生成 1200×630 卡片图（见 §十二 待办）。

## 七、踩过的坑（写进代码注释，不重复踩）

| # | 坑 | 处置 |
|---|---|---|
| 1 | `z` 从 `astro/zod` 导入（Astro 6 起，Zod 4），旧教程写 `astro:content` 会失败 | `content.config.ts` 已按新写法 |
| 2 | `getCollection()` 返回顺序**非确定** | 每个页面都显式 sort |
| 3 | `render()` 是导入的函数，不再是条目方法 | `posts/[...slug].astro` |
| 4 | ~~MDX 的 Shiki 主题要配两遍~~——**旧教程的说法，Astro 7 实测不成立** | 只在 `markdown.shikiConfig` 配一处即可 |
| 5 | Pagefind 的 `pagefind-ui.js` 是 IIFE、不导出；动态 `import()` 会**静默失败** | 搜索页按经典 `<script>` + 读全局实现，并加 fail-loud |
| 6 | Shiki 双主题：首个主题写进 inline `color`，后续主题才是 `--shiki-dark`；**`--shiki-light` 不存在**（已对构建产物核验） | 浅色不覆盖 color；深色只覆盖 span 的 `color` |
| 7 | 深色下若给 span 覆盖 `background-color`，会与 pre 底色不一致，代码块呈网格状色块 | 只覆盖 `color`，不碰 span 背景 |
| 8 | 作者习惯用 `#` 写正文小节 → 单篇多个 h1 | 文章统一从 `##` 起；schema 不强制，靠约定 |
| 9 | **Sätteri 的 `features.math` 默认 `false`**；不开启时 `$..{x}..$` 会被 MDX 当 JSX 表达式，`ReferenceError: x is not defined` ⇒ **整页构建失败**（不是"不渲染"这么温和） | 见 §六之三 |
| 10 | **开了 math 也只是标记、不排版**：产物为 `<code class="language-math math-inline">原始 LaTeX</code>` | 需自挂渲染器，见 §六之三 |
| 11 | `astro preview` 开着时构建会 `EBUSY: rmdir dist/.prerender/chunks`（预览服务占住 dist 句柄），**与代码无关** | 构建前先停预览服务 |
| 12 | **`post.body` 会把 MDX 的 `import X from '…'` 原样带进原始 Markdown**——MDX 专用语法，在 `.md` 里是噪声且相对路径失效 | 取正文时按行剔除该形态，并折叠多余空行 |
| 13 | 新端点（`llms.txt.ts` 等）也过 `astro check`：未使用的 import 判警告、`.filter()` 参数不标注则 ts(7006) 隐式 any 判**错误** | 标注参数类型、删无用 import。**门禁是全绿硬门槛** |
| 14 | **UA 样式表给 `code` 单设 `font-family: monospace`，不继承 `pre`** ⇒ 只把字体写在 `pre`（`.astro-code`）上，文字仍渲染成 generic `monospace`；而显式设过的行内 `code` 反而是对的 ⇒ "代码框与正文不同字体" | **必须加 `.astro-code code { font-family: inherit; }`**。同族风险：`pre` / `textarea` / `input` / `kbd` / `samp` |
| 15 | 验证字体别量错层：`pre` 的 computed `font-family` 正确**不代表**文字用它——文字在 `<code>` 里 | 量**真正装文字的那一层**；必要时逐层打印 `pre` / `code` / `span` |

## 八、质量门禁

```
npm run check      # astro check（类型）
npm run contrast   # 对比度审计，零依赖，fail loud
npm run build      # astro build + pagefind
npm run gate       # 上面三步串联
```

对比度脚本的纪律：颜色字面量只允许在 `tokens.css` 且必须是
`light-dark(浅, 深)` 双值形态；每对前景/背景有显式阈值；**不满足且未登记豁免理由
即判红**——"不足要有兜底说明"。

## 九、门禁实测状态（2026-10-13 跑通）

| 门禁 | 结果 |
|---|---|
| `astro check` | **0 错误 0 警告 0 提示**（17 个文件） |
| 对比度审计 | **34 项通过，4 项登记豁免**（`chrome-border` / `surface-border` 为装饰性描边，WCAG 1.4.11 不适用） |
| `astro build` | **13 条路由全部生成**，`dist/` 完整 |
| Pagefind | 12 页 / 494 词；已因 `data-pagefind-body` 从"索引全部 body"收敛为"只索引正文页" |

**运行时载荷实测**（不是估算）：

| 页面 | 内联脚本 | 内联 JS 原始字节 | 外链 JS |
|---|---|---|---|
| 首页 / 关于 | 2 | 1250 | **0** |
| 文章页 | 3（机框标注 + 复制按钮） | 2628 | **0** |
| 搜索页 | 3（含 Pagefind 加载器） | 2351 | **0** |

CSS 单文件 9236 字节（未压缩）。**外链 JS 恒为 0**——没有运行时框架，
那 1.2–2.6 KB 全是内联脚本（gzip 后约 0.4–1.0 KB）。

**字体只增加在文章页**：首页 / 归档 / 标签 / 搜索共 0 字节字体请求；
文章页多一个 `jetbrains-mono-latin.woff2` = 21,168 字节（走 preload，与 HTML 并行取）。

## 十、挂起项：Vitro 后端接入

为那个阶段预留的、现在**只占位不实现**的东西：

- `src/content/posts/` 下将来会有可运行片段；片段需同时服务「高亮展示」与
  「喂给引擎」，所以**单源**原则现在就定：代码存独立文件，MDX 引用，不内联两份。
- 内容集合若设 `retainBody: false` 会丢掉源码 body，引擎阶段取不到——**暂不设**。
- 接入方式已定方向：只依赖引擎公开契约（wasm 导出面 + 帧协议 + 生成的协议类型包），
  不抄 demo 实现。详见 Vitro 仓 2026-10-12 工作日志。

## 十一、部署（GitHub Pages，2026-10-13 已上线）

- **仓库**：`rustin-beep/rustin-beep.github.io`（public）。
  仓库名**恰好等于 `<user>.github.io`** ⇒ GitHub Pages 的**用户主页**，
  地址是根路径 `https://rustin-beep.github.io/`，**不需要 `base` 前缀**。
- **站点地址单源**：`SITE_URL` 在 `src/site.config.ts`，由 `GITHUB_HANDLE` 推导；
  `astro.config.mjs` 导入它并用作 `site`（RSS 与 sitemap 的绝对链接都靠它）。
  换自定义域名只改这一行。
- **流水线** `.github/workflows/deploy.yml`：
  `actions/checkout@v7` → `withastro/action@v6`（内部 setup-node 24 / 安装 /
  跑 `npm run build` / `upload-pages-artifact@v5`）→ `actions/deploy-pages@v5`。
  `permissions: contents:read + pages:write + id-token:write`；
  `concurrency: pages, cancel-in-progress: false`（不取消进行中的部署，
  避免半成品留在线上）。
- **它在 CI 里跑的就是我们的 build 脚本**，即 `astro build && pagefind --site dist`：
  **搜索索引在 CI 里一并产出**，不需要额外步骤。
- **Pages 需要手动切成 Actions 发布**：新建的 `<user>.github.io` 仓库会被 GitHub
  自动启用 Pages，但默认 `build_type: legacy`（从分支发布）。必须 PUT 成
  `build_type: workflow`，否则部署步骤拿不到 Pages 站点：
  ```bash
  gh api -X PUT repos/<owner>/<repo>/pages -f build_type=workflow
  ```
- git 身份是**仓库局部**配置：`rustin-beep` + `249558894+rustin-beep@users.noreply.github.com`
  （noreply 地址，避免把个人邮箱写进公开的永久历史）。
- `.gitattributes` 锁 `* text=auto eol=lf`：不加的话 Windows 的 `core.autocrlf=true`
  会把检出写成 CRLF，之后每次改动都是整文件假改动、blame 失效。

## 十二、待办 / 未决

- [x] 依赖安装、`astro check`、`astro build` 全部跑通（见第九节实测）
- [x] `site` 字段改为真实地址（由 `site.config.ts` 的 `SITE_URL` 提供）
- [x] 部署到 GitHub Pages（见第十一节）
- [x] 代码字体接入（见 §六之五）
- [x] 字号改流式，同时随浏览器字号与屏幕宽度（见 §六之六）
- [ ] **浏览器实跑一遍交互**：复制按钮、主题切换、搜索（已截图看过渲染，但这三项的
      点击行为仍未验证）
- [ ] 数学公式渲染器未接（见 §六之三）
- [ ] 中英混排的 `text-autospace` 实际效果需在浏览器里看一眼再定
- [ ] 自定义域名？（若要，改 `SITE_URL` + 仓库 Pages 设置 + DNS）
- [ ] **本地已改但未提交**：本轮（流式字号 + 面向 AI 的文章设计 + 阅读统计 + 分享卡片）
      改动未经用户允许不得提交，见 §十三

### 审计出的缺口（2026-10-13 盘点，均未做）

按"缺了会明显影响使用"排序：

| # | 缺的东西 | 为什么算缺 |
|---|---|---|
| 1 | **文章目录（TOC）** | Astro 已经把 `headings` 数组算好并交给布局（含 id 与层级），**当前一处没用——是死数据**。长文没有目录，只能一路滚 |
| 2 | **上一篇 / 下一篇** | 读完一篇无处可去，只能回列表页重找。集合里排序信息现成，成本很低 |
| 3 | **`og:image` 1200×630 卡片图** | 现在拿头像（正方形）顶替。微信群/Twitter 的卡片会裁得很难看。可构建期用 SVG→PNG 生成 |
| 4 | **正文里的图片支持** | 内容 schema 没接 Astro 的图片处理；将来插图会走原生 `<img>`，**没有尺寸、没有懒加载、没有响应式**，是 CLS 的直接来源 |
| 5 | **阅读进度条** | 长文体感辅助。非必需，但成本低 |
| 6 | **评论** | 需要后端或第三方（如 giscus），涉及外部依赖与隐私取舍，**须用户先拍板** |

**明确不做**（记录以免反复讨论）：

- **数学公式渲染器**：已有结构方案（KaTeX MathML，构建期、零运行时），
  当前无公式文章，**等真有需求再接**（见 §六之三）。
- **站内外链的 hover 预览、回到顶部按钮、站内搜索的键盘导航**：锦上添花，
  与"零外链 JS"的取舍冲突，不做。

## 十三、提交纪律（2026-10-13 用户明令）

**未经用户明确允许，禁止 `git commit` 与 `git push`。**

2026-10-13 早先那两次提交推送是用户在当轮明确要求的；此后用户撤回该授权，
改为逐次许可。**agent 不得把"上次让提交过"当成持续授权。**
