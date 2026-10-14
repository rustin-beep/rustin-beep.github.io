# 博客方案 · 之二 —— C 进博客（Vitro 程序层）

> **与《PLAN.md》（之一）的关系**：PLAN.md 阶段一定稿「只做博客本体」，把 Vitro 接入
> 整体挂起，并预留两条接口（§十）：① 代码存独立文件、MDX 引用，不内联两份；
> ② 只依赖引擎公开契约（wasm 导出面 + 帧协议），不抄 demo 实现。
> 本文件是那个挂起阶段的计划。**2026-10-14 用户拍板启动，并同意第九节全部三项决策。**
> 本文件不修改 PLAN.md 已定事项；如有冲突，以 PLAN.md 为准并在此登记。

## 一、定位：C 是计算层，占两个执行槽位

**做**：让 .c 文件成为与 posts 平级的内容类型，运行在 Vitro 上；并让 C 参与博客的
构建期计算（数据表烘焙、门禁对账）。

**两个执行槽位**（同一份钉死的 wasm，两个时间点）：

```
构建期（npm run build 期间，Node ≥23 驱动 wasm，跑完即消失）
  ├─ .c 的 stdout 烘焙进 HTML（数据表 / 内容块——静态产物，零运行时）
  └─ 门禁：每个 program 编译通过 + @expect 输出对账（挂了构建红）

读期（读者浏览器里同一个 wasm，内联 JS 桥接）
  ├─ 程序页：运行 + 时间旅行 scrubber（变量表/调用栈/数组/stdout-so-far/断点）
  └─ 文章内小工具：C 计算内核 + JS chrome（收参数、画结果）
```

C **不是**内容展示层（高亮是 Shiki 的事），**不是**机制层（路由/RSS/og 是 Astro/TS
的事）。**没有计算可做的部件，不加 C**——负面清单见第八节。

## 二、引擎事实（全部实测；证据 = `.workbuddy/probe-cap*.mjs` / `probe-debug*.mjs` / `probe-verify.mjs` / `probe-final.mjs`）

### 产物指纹（钉死，换版本 = 重新核实本节全部数字）

| 项 | 值 |
|---|---|
| 文件 | `public/vitro/wasm.wasm` · 956,257 字节 |
| md5 | `71a037c48f756915ecddcaa44abc3f4c` |
| 版本 | engine 0.8.0 · protocol v0.1 |
| 导出面 | `invoke / reset / engine_version / protocol_version`（NDJSON 帧协议，单出口） |

### 运行前提（Node 矩阵，2026-10-14 实测）

| 运行时 | 实例化 wasm | |
|---|---|---|
| 托管 Node 22.22.2 | **失败** | `WebAssembly.instantiate(): Import #0 module="_": module is not an object or function`（缺 `importedStringConstants` 编译选项） |
| Node 24.21.0 | 成功 | `ping → pong`（CI 的 withastro/action 内部即 Node 24 ⇒ **构建期槽位在 CI 无阻塞**） |
| 系统 Node 25.9.0 | 成功 | `ping → pong` |

⇒ 构建期 C 步骤要求 **Node ≥23**。Astro 本体只要 ≥22.12，不受影响；受影响的只有
`check-programs` 等 C 驱动脚本——本地用系统 Node 跑 `npm run gate`，或在脚本里
fail-loud 提示当前 Node 太老。

### 能力边界（超出即不可做；教学程序恰好都在界内）

| 维度 | 实测 | 后果 |
|---|---|---|
| 步数 | 默认上限 10,000,000（trap `[step-limit]`）；`max_steps` 可调（设 1 亿生效并 trap 在 1 亿） | 单次 ~250ms；调大 = 冻结主线程约 2s，慎用 |
| 堆 | `quarantine_budget` 默认 262144；可调但**钳顶 1MB**（设 4MB 回 1MB；1MB 时 512KB 成 / 1MB 败） | 大数组、大 DP 表不可 |
| 调用深度 | `call_depth_limit` 默认 10000 | 深递归 trap「值栈溢出」 |
| 数据模型 | **ILP32**：`long`/`size_t`/指针 = 4B，`long long`/`double` = 8B | Linux 源码搬来 `long` 语义静默改变；整数溢出是**受检 trap 不回绕**（`long s` 累加在 i≈65k 处炸） |
| 时间/随机 | `time()`/`clock()` 恒 0；`rand()` 确定性（同 seed 同序列） | 计时/真随机不可；可复现是特性 |
| 进程/环境 | `getenv`/`system` 未定义（E3036） | 无进程、无环境变量 |
| argv | **传给 `run({argv})` 有效**（argc/argv 实测送达；`config.set`/`compile` 传无效） | CLI 形态 demo 可以 |
| stdin | **无 EOF**（`input_mode_batch` 设置被静默拒绝、`feed{eof:true}` 被忽略） | 程序必须有限次读取；`while(scanf!=EOF)` 无法收尾 |
| printf | `d/i/o/u/x/X c f/e/E g/G s/p` + 宽度/精度/`*`/`ll`；**`%%` 输出两个 %**（引擎 bug，Vitro issue #82） | 文章引用时注意 |
| scanf | `d/u/f/c/s/i/x/o` | |
| 文件 | VFS 每会话内存盘；**预置 `numbers.txt`（"1 2 3 4 5"）、`test.txt`（"hello\nworld"）可 `fopen` 读**；跨会话丢失 | 数据类 demo 不靠 stdin |
| 多文件 | `compile {files:[{filename, source}]}`——**键名是 `filename` 不是 `name`**；`.h` 放进 files 后 `#include "x.h"` 由引擎 vfs 解析 | 文件集可以 |
| 诊断 | `error_catalog` 全中文（分类/解释/常见原因/图标）；除零/越界/空指针/溢出/栈深/步数全是受检 trap 带人话 | 教学友好，比原生 C 的 UB 强 |
| 第三输出流 | `note`（引擎审计文本域，UTF-8 直传，不过 latin1） | 面板可展示 |
| 内存地图 | `memory.regions`：global/heap/stack 分区 + quarantine + free_list | 可上图 |
| compile 响应 | `ok / diagnostics / preprocessor_trace`（宏展开轨迹）/ `algorithm_matches`（**当前恒空**——demo 的 🧭 算法识别卡是预留形态，不承诺） | |

### 步进与时间旅行（ scrubber 的数据源，全部实测）

| 维度 | 实测 | 结论 |
|---|---|---|
| 协议序 | `gw.reset() → session.create → config.set → compile → run{argv?} → step.begin → breakpoints.set{lines} → step.next 循环` | **`run` 必须先行**（否则 `algorithm_step`/`vis_events` 恒空）；**断点必须在 `step.begin` 之后**下发（begin 重建 vm 会清断点） |
| 帧内容 | `step_index / code_line / func_name / semantic_label`（中文：「循环 i=0」「调用 printf」）/ `local_vars`（名/类型/值/地址）/ `call_stack` / `array_snapshots` / `accessed_vars` / `heatmap_line+count`（真实执行次数） | scrubber 面板的全部数据 |
| 断点 | `breakpoints.set({lines:[6]})` 后 `step.next` 到第 6 行真暂停（`paused`） | 读者可设 |
| 采集吞吐 | ~11.5k 帧/s；原始 payload ~730 B/帧（fib(20) 27.3 万帧 = 229MB JSON） | **必须截断**：`STEP_FRAME_CAP = 4000` 帧（沿用 demo 设计，超界提示截断） |
| `seek({step:N})` | 可用，**2.42ms/次**（300 次 = 726ms） | **拖条必须走本地帧数组**；seek 只做「超界引擎跳转」 |
| 回放中 stdout | 随步增长（第 14/30/46 帧分别吐出 line1/line2/line3） | 采集时顺带记录每帧输出长度 ⇒「到此为止的输出」 |
| `payload.get({start:N})` | 范围查询可用 | 备用 |
| config 粘滞 | config 是**引擎级全局**，`session.create` 不重置（`max_steps` 跨会话粘滞）；`reset()` 保留 config，`session.create` 清 runtime | 每次 run 显式回设基准 config |
| 语句级粒度 | 按 `code_line` 合并相邻帧（demo 的 coalesceStmt 形态） | 冒泡 870 指令帧 → 几十语句帧，节奏逼近手编且每帧仍真值 |

### 与 Vitro demo 的关系

读 `D:\code\Vitro\demo/js/timetravel.ts`（445 行）是为了把**协议序学正确**（run 先行、
断点后置、本地帧回放、4000 上限、seek 分工）——那些注释是引擎行为的权威佐证。
**实现自己写，不抄 demo 代码**：PLAN.md §十 第二条的落实。

## 三、内容模型：.c 一等公民

### 目录与路由

```
src/content/programs/*.c      # 与 posts/ 平级；一个文件 = 一个程序
src/lib/programs.ts           # 与 lib/posts.ts 平级
src/pages/programs/index.astro        # 程序索引页
src/pages/programs/[slug].astro       # 程序页
src/layouts/ProgramLayout.astro       # 程序页布局
```

- `lib/programs.ts`：`import.meta.glob('?raw', {eager:true})` 构建期读入（Vite 核心，
  零运行时 fetch）+ 头注释解析 + **slug 取文件名**（不含目录，对齐 postSlug）
  + **fail-loud slug 去重**（照抄 posts 守卫）。
- `@draft` 出现即草稿：不进任何产物（页面/sitemap/RSS/搜索索引/llms.txt），
  语义对齐 posts 的 `draft`。

### 头注释约定（元数据唯一真相源，不设 sidecar/登记表）

```c
// @title 冒泡排序
// @desc 五个数，八七〇步，逐帧看交换怎么发生
// @tags 排序,算法
// @argv --fast 42
// @stdin 3 1 2
// @expect 1 3 5 8 9
// @draft
```

| 字段 | 必需 | 语义 | 落到哪 |
|---|---|---|---|
| `@title` | 是 | 程序名（≤60 字） | 页面标题 / og / llms.txt |
| `@desc` | 是 | 一句话（≤160 字） | meta / 索引 / og |
| `@tags` | 否 | 逗号分隔 | 标签页（与文章共享） |
| `@argv` | 否 | 空格分隔 | `run({argv})` |
| `@stdin` | 否 | 预喂 stdin 行 | 面板自动喂入（无 EOF 世界的有限读取） |
| `@expect` | 否 | 期望 stdout（单行） | gate 对账 |
| `@draft` | 否 | 出现即草稿 | 不进任何产物 |

**Fail-loud 规则**（对齐 posts schema 的 `.strict()`）：缺 `@title`/`@desc` → 构建红；
未知 `@key` → 构建红；slug 重名 → 构建红。头注释本身是合法 C 注释，不影响编译；
解析器只扫文件头。

## 四、渲染与运行

- **高亮**：`import { Code } from 'astro:components'`（实测 `Code.astro` 在，
  吃 astro.config 的 shikiConfig，与正文代码块同主题，不引 shiki 包）。
- **运行脚本泛化**：PostLayout 那段 `is:inline` 从只绑 `pre.astro-code[data-language="c"]`
  改为绑 `[data-vitro]` 容器，抽成共享组件，PostLayout / ProgramLayout 共用一份——
  单一真相源，**外链 JS 恒 0 不破**。每条 C 块/程序的数据（argv/stdin/frame cap）
  走 data 属性。
- **时间旅行 scrubber（程序页全开）**：采集（第二节协议序）→ 本地帧数组 →
  拖条 + 播放（时间戳驱动，渲染跟不上自动合帧）+ 当前行高亮 + 变量表 + 调用栈 +
  数组柱状图 + 「到此为止的 stdout」+ 断点 + 引擎跳转（seek 只做超界）。
  语句级/指令级双粒度切换。`prefers-reduced-motion` 时禁自动播放。
- **MDX 引用真身**：`import src from '../../content/programs/bubble.c?raw'`——
  手抄片段与真实文件漂移的问题一次性消失。文章里的 ```c 围栏退化为速记片段
  （见第九节拍板 ③）。

## 五、构建期槽位：C 参与博客机制的两个点

1. **内容生成**：.c 的 stdout 在构建时烘焙进 HTML——基准表、数据块由程序算出，
   表格旁边挂着可运行真身。「这个数是这段程序算的，点运行自己复现」从修辞变机制。
2. **门禁**：`npm run gate` 加 `scripts/check-programs.mjs`——每个 program
   编译通过 + `@expect` 对账 stdout。**引擎行为静默漂移会被构建红抓到**，
   这正是 md5 钉死纪律要防的事（与 og 的 `assertCjkGlyphs` 同思路）。

## 六、读期槽位

C 是计算内核，JS 是 chrome：文章内小工具（计算器/模拟器）由 JS 收参数、C 算、JS 渲染。
**混合图表**：C 打印数据系列，JS 画图——绕开「只有文本 I/O」的正解，计算归引擎、呈现归 JS。

## 七、站点账本（第二内容类型）

| 机制 | 现状 | programs 接入 | 工作量 |
|---|---|---|---|
| sitemap | `@astrojs/sitemap` 自动枚举静态路由 | **白进** | 0 |
| pagefind | `astro build && pagefind --site dist` 扫全量 HTML | **白进索引** | 0 |
| llms.txt | 枚举 posts | 加 programs 区（照 posts 形态） | 小 |
| og:image | `og/[slug].png.ts` 按 posts 生成 | getStaticPaths 扩展，slug 加 `programs/` 前缀防撞；og-card.ts 内容无关直接复用 | 小 |
| 标签 | `tags/[tag].astro` 聚合 posts | **共享**（拍板 ②） | 小 |
| RSS | 枚举 posts | **暂不做**（拍板 ②）：程序少时开 feed 是噪音，留扩展位 | 0 |

## 八、C 的负面清单（范围防蠕变）

路由、layout、组件、样式、TOC、阅读时长、RSS/sitemap/og/llms/pagefind、
DOM/网络/存储/定时器——要么没有计算可做，要么 C 物理碰不到。硬塞 = 多养一条工具链
+ CRLF/编码坑 + CI 多一步编译，收益为零。**这些部件加 C 是负分。**

## 九、已拍板的决定（2026-10-14 用户同意）

1. **元数据走 .c 头注释**（`@title/@desc/@tags/@argv/@stdin/@expect/@draft`），
   不设 sidecar、不设登记表——单一真相源，反漂移。
2. **RSS 暂不为 programs 开 feed**（留扩展位）；**标签共享** `tags/[tag].astro`——
   「排序」标签页同时列文章和程序，语义连贯且不加机制。
3. **MDX 的 ```c 围栏退化为速记片段**：不承担运行/对账职责；要运行、要对账，
   一律引用 .c 真身（`?raw`）。**存量文章（c-run-button / 一百四十五毫秒）的围栏
   保持原样不强制迁移**——围栏运行能力保留，两条通道长期并存，新写可运行程序一律 .c。

## 十、成本与纪律

**内联 JS 预算**（2026-10-14 骨架落地后**实测**，外链恒 0）：

| 页面 | 内联脚本 | 字节（实测） |
|---|---|---|
| 普通文章页 | 机框 + 主题 + TOC | ≈3.6KB |
| 含 C 围栏的文章页 | + VitroRunner | VitroRunner **15,327 B** + CodeFrame 1,640 B（共 ≈20.0KB） |
| 程序页 | CodeFrame + VitroRunner + VitroScrubber | 共 **35,541 B**（Scrubber 17,316 B） |
| 程序索引 / 首页 | 仅主题 | 1,258 B |

> 早前记忆里的「运行脚本 ≈5.4KB」是**估算、且低估了一个量级**——脚本自带协议文档
> （引擎指纹、实例化理由、EOF 说明），注释随 `is:inline` 一并下发。gzip 后程序页
> 约 10KB。要瘦身：把长注释移进组件 frontmatter（不下发）或构建期剥注释，
> 属后续优化，先如实记账。scrubber 只进程序页——文章页不付这份钱。

**新文件**：`src/content/programs/*.c`、`src/lib/programs.ts`、
`src/pages/programs/{index,[slug]}.astro`、`src/layouts/ProgramLayout.astro`、
共享运行脚本组件、`scripts/check-programs.mjs`。
**改动文件**：`PostLayout.astro`（脚本抽出共享）、`llms.txt.ts`、`og/[slug].png.ts`、
`tags/[tag].astro`、`package.json`（gate 链）。

**纪律继承**（全是从 PLAN.md / 项目记忆原样搬来的）：
md5 钉死 + 面板版本戳（engine/proto）；颜色字面量只允许在 `tokens.css`，
scrubber 样式全走令牌；`prefers-reduced-motion` 双轨；LF 行尾（`.gitattributes` 已锁）；
构建/长命令输出不接 `head`（SIGPIPE 会杀构建）；**引擎换版本（`npm run sync-vitro`）
后第二节全部数字必须重新实测**——本文件的结论只对 md5 `71a037c4` 负责。

## 十一、落地顺序（未开始，等用户口令）

- [x] **① 骨架**（2026-10-14 完成）：`bubble.c`（带头注释）+ `lib/programs.ts` +
      程序页 + ProgramLayout + 运行脚本泛化（`[data-vitro]` 共享组件）。
      **实测**：`astro check` 0/0/0；build 绿（/programs/、/programs/bubble/ 生成，
      pagefind 25 页）；CDP 19/19 PASS（程序页运行 872 步输出 `1 3 5 8 9`、
      二次运行可复现、引擎版本戳、手机 390 无横向溢出、文章页 8 块回归全通）；
      对比度 34 项通过。脚本已抽为 `CodeFrame.astro`（1,640B）+
      `VitroRunner.astro`（14,557B），PostLayout 从 586 行降到 202 行。
      **待用户确认的展示决策**：代码块含 .c 头注释（显示即所跑，单一副本）。
- [x] **② scrubber**（2026-10-14 完成）：`VitroScrubber.astro`（17,316 B，仅程序页注入，
      经 `window.__vitroCore` 接缝复用 VitroRunner 的引擎装载/协议层）。采集 =
      run 先行 → step.begin → step.next 分批（250 帧/批，批间让出主线程）→ 投影帧
      （~730B→~150B）+ 按批记 stdout 长度；回放 = 本地帧拖条 + 时间戳驱动播放
      （合帧）+ 语句/指令双粒度（872 指令帧 ↔ 33 语句帧）+ 当前行高亮 + 变量表 +
      调用栈 + 数组柱状 + 到此为止的 stdout。**实测**：CDP 17/17 PASS；踩过并修掉
      两个 bug——① `state.lens` 漏赋导致 stdout 切片全 undefined；② 自动播放被
      `play()` 的 busy 守卫挡掉（finally 之后才解锁）。未接：断点/调用树/引擎跳转/内存地图（v2）。
- [x] **②b 星形活页 /live/（已删除，2026-10-14 用户裁定）**：建成后同日撤除——理由：
      对读者而言活页与程序页无可感差异（都是"点运行/点回放"），多实例拓扑在没有
      "对比视图"之前是装饰。**程序页与活页一并删除**（`src/live/`、`src/content/programs/`、
      `src/pages/programs/`、`ProgramLayout.astro`、`lib/programs.ts`），能力全部回归
      MDX 围栏：文章里每个 ```c 块仍可运行、可回放（CodeFrame / VitroRunner /
      VitroScrubber 三组件保留，PostLayout 接线不动）。
      保留的实测结论（供将来重启这条线）：中枢"实时模式"吐 `#TASK` 派发表 → JS 按表
      为每任务开**全新实例**（argv 带分片）→ 中枢带结果跑"回放模式"（argv 供入、零 scanf
      ⇒ 帧覆盖完整）；**scanf 之后的执行不再出帧**（上游已提 #86/#88）。
      同日上限实验室：10M 是软护栏（`max_steps` 一行即过）；**4000 帧是 demo 的前端预算、
      不是引擎上限**——实测采集侧 20k 帧 = 1.45s / 1.7MB、50k 帧 = 2.56s / 4.4MB；
      `seek` 是 O(N) 从头重放（上游已提 #87）。
- [ ] **③ gate**：`scripts/check-programs.mjs`（编译 + `@expect` 对账），Node ≥23 前提落实
- [ ] **④ 站点账本**：llms.txt 区 / og 扩展 / 标签共享
- [ ] **⑤ 构建期内容生成**：.c stdout 烘焙进文章（拿 145ms 篇的一张表开刀）
- [ ] **⑥ 重估**：programs 多起来后再看 RSS / 索引页丰富化

## 十二、提交纪律

**未经用户明确允许，禁止 `git commit` 与 `git push`**（PLAN.md §十三，2026-10-13 用户明令，
逐次许可）。本文件及后续实现同样受其约束。
