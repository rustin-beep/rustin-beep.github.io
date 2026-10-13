import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * 分享卡片（og:image）—— 1200×630，构建期栅格化
 * ============================================================================
 * 为什么要有它：原来的 og:image 直接用头像（正方形，180×180）。链接分享到
 * 微信群 / Twitter / Slack 时，卡片位是 1200×630 的横图，正方形徽头会被裁得
 * 只剩中间一条，观感像"图挂了"。这里按平台要求的比例自己画一张。
 *
 * 实现路线：**SVG（自己拼）→ sharp 栅格化**。
 *   · 不需要浏览器、不需要 canvas、不需要 webfont 下载；sharp 是 astro 的
 *     传递依赖（`npm ls sharp` → astro@7.3.8 → sharp@0.35.5），CI 里 `npm ci`
 *     一并装上，所以不额外声明也不会缺。
 *   · 不依赖网络：**刻意不把 GitHub 头像合成进去**——构建期的网络请求会让
 *     CI 变成偶发失败源。头像仍然是 favicon / 页头 logo，只是不进卡片。
 *
 * ★ 唯一的真实风险是**中文字体**：SVG 里的中文靠系统 fontconfig 找字体。
 *   Windows/macOS 一定有；Linux（CI 的 ubuntu-latest）不一定。
 *   找不到时的表现是**静默画出豆腐块或空白**——那还不如回到正方形头像。
 *   所以下面有 assertCjkGlyphs() 做**开图前的自检，缺字体直接 fail loud**，
 *   并且 .github/workflows/deploy.yml 里显式装了 fonts-noto-cjk。
 *
 * ★ 配色不在这里硬编码：从 src/styles/tokens.css 解析 light-dark() 的**浅色值**，
 *   与站点其余部分共用同一份真相源（PNG 渲染器读不到 CSS 变量，只能这样取）。
 */

/* ------------------------------------------------------------ 取配色令牌 */

let cachedTokens: Map<string, string> | undefined;

function tokensCssPath(): string {
  const candidates = [
    fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
    join(process.cwd(), 'src', 'styles', 'tokens.css'),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error(
    `og:image 生成器找不到 src/styles/tokens.css（试过：${candidates.join(' / ')}）。配色单一来源断了，拒绝用兜底色继续。`,
  );
}

function lightTokens(): Map<string, string> {
  if (cachedTokens) return cachedTokens;
  const css = readFileSync(tokensCssPath(), 'utf8');
  const re =
    /--([\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g;
  const map = new Map<string, string>();
  for (const m of css.matchAll(re)) map.set(m[1], m[2].toLowerCase());
  cachedTokens = map;
  return map;
}

/** 取令牌的浅色值；缺失即 fail loud（不许静默用错颜色） */
function color(name: string): string {
  const v = lightTokens().get(name);
  if (!v) {
    throw new Error(
      `og:image 生成器要的令牌 --${name} 在 tokens.css 里不存在或不是 light-dark(浅, 深) 双值形态。`,
    );
  }
  return v;
}

/* ---------------------------------------------------------- 中文字体自检 */

// 与 SVG 里用的同一个字体栈。Linux 上靠 fontconfig 挑第一个可用的。
const FONT_STACK =
  'Microsoft YaHei, PingFang SC, Hiragino Sans GB, Noto Sans CJK SC, Noto Sans SC, WenQuanYi Zen Hei, Heiti SC, sans-serif';

let fontChecked = false;

/**
 * 开图前自检：真的能画出中文吗？
 *
 * 判据是"像素墨量"。没字体时 librsvg 不会报错，只会画空白或豆腐块：
 *   · 画不出来 → 墨量≈0 → 判红
 * 门槛定得松（>0.5% 铺墨），只要能排出字就过；**它挡不住"字体风格不对"，
 * 只挡得住"根本没有中文字体"**——这一条是最容易在 CI 上静默发生的。
 */
export async function assertCjkGlyphs(): Promise<void> {
  if (fontChecked) return;
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
  <rect width="400" height="120" fill="#ffffff"/>
  <text x="10" y="80" font-family="${FONT_STACK}" font-size="64" fill="#000000">字体自检中文</text>
</svg>`;
  const { data, info } = await sharp(Buffer.from(probe))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (const v of data) if (v < 128) ink++;
  const ratio = ink / (info.width * info.height);
  if (ratio < 0.005) {
    throw new Error(
      [
        'og:image 生成失败：当前系统没有可用的**中文字体**，SVG 里的中文会画成空白/豆腐块。',
        '这不是代码问题，是构建环境缺字体。修法二选一：',
        '  · Linux/CI：apt-get install -y fonts-noto-cjk（deploy.yml 里已有这一步，若仍报错说明该步骤被跳过）',
        '  · 本地 Windows/macOS：正常不会走到这里，出现即为字体栈全被拒',
        '刻意不静默降级：宁可构建红，也不把豆腐块卡片发到微信群。',
      ].join('\n'),
    );
  }
  fontChecked = true;
}

/* ---------------------------------------------------------------- 排版量 */

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** 是否"全角宽"字符（CJK 汉字 / 假名 / 谚文 / 全角标点） */
function isWide(cp: number): boolean {
  return (
    cp === 0x3000 ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  );
}

/** 单字宽度的粗略估计：全角 1em、半角 0.55em、空格 0.28em */
function widthOf(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === ' ') w += size * 0.28;
    else if (isWide(cp)) w += size;
    else w += size * 0.55;
  }
  return w;
}

/** 切成"最小不可再切的单元"：汉字单字成 token，拉丁词连着后面的空格成 token */
function tokenize(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isWide(cp)) {
      if (buf) out.push(buf);
      buf = '';
      out.push(ch);
    } else if (ch === ' ') {
      buf += ch;
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let cur = '';
  let curW = 0;
  for (const tok of tokenize(text.trim())) {
    const w = widthOf(tok, size);
    if (cur && curW + w > maxWidth) {
      lines.push(cur.trimEnd());
      cur = '';
      curW = 0;
      if (lines.length === maxLines) break;
    }
    cur += tok;
    curW += w;
  }
  if (lines.length < maxLines && cur) lines.push(cur.trimEnd());

  if (lines.length >= maxLines) {
    // 末行溢出就砍到能放下省略号为止
    let last = lines[maxLines - 1];
    while (last.length > 1 && widthOf(last + '…', size) > maxWidth) {
      last = last.slice(0, -1);
    }
    const truncated = last !== lines[maxLines - 1];
    lines.length = maxLines;
    lines[maxLines - 1] = truncated ? last + '…' : lines[maxLines - 1];
  }
  return lines;
}

/* ------------------------------------------------------------- 卡片绘制 */

export interface OgCardInput {
  /** 顶部小字：站点显示名 */
  site: string;
  /** 顶部小字：@handle（可省） */
  handle?: string;
  /** 主标题（文章标题 / 站点一句话） */
  title: string;
  /** 副文本：摘要 */
  description: string;
  /** 底部左：日期 · 标签 */
  footerLeft: string;
  /** 底部右：域名 */
  footerRight: string;
}

const W = 1200;
const H = 630;

export async function renderOgCard(input: OgCardInput): Promise<Buffer> {
  await assertCjkGlyphs();

  const c = {
    bg: color('color-bg'),
    paper: color('color-surface'),
    fg: color('color-surface-fg'),
    muted: color('color-surface-muted'),
    rule: color('color-chrome-border'),
    accent: color('color-accent'),
    hairline: color('color-surface-border'),
  };

  // 几何：整张 1200×630，中间一张"白纸"，顶边一条锈色结构线（呼应页头那条 2px）
  const P = { x: 44, y: 40, w: W - 88, h: H - 80 };
  const pad = 64;
  const textX = P.x + pad;
  const rightX = P.x + P.w - pad;
  const innerW = P.w - pad * 2;

  const TITLE = 52;
  const TITLE_DY = 68;
  const TITLE_LINES = 3;
  const D_TITLE_Y = 226;

  const titleLines = wrapText(input.title, innerW, TITLE, TITLE_LINES);
  const descY = D_TITLE_Y + titleLines.length * TITLE_DY + 14;
  const descLines = wrapText(input.description, innerW, 27, 2);

  const parts: string[] = [];

  parts.push(
    `<rect width="${W}" height="${H}" fill="${c.bg}"/>`,
    `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="${c.paper}" stroke="${c.rule}" stroke-width="2"/>`,
    // 顶部锈色结构线
    `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="8" fill="${c.accent}"/>`,
    // 顶部小字：站名 · @handle
    `<text x="${textX}" y="126" font-family="${FONT_STACK}" font-size="30" fill="${c.accent}">${esc(input.site)}${
      input.handle
        ? `<tspan font-size="26" fill="${c.muted}">　@${esc(input.handle)}</tspan>`
        : ''
    }</text>`,
  );

  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${textX}" y="${D_TITLE_Y + i * TITLE_DY}" font-family="${FONT_STACK}" font-size="${TITLE}" font-weight="600" fill="${c.fg}">${esc(line)}</text>`,
    );
  });

  descLines.forEach((line, i) => {
    parts.push(
      `<text x="${textX}" y="${descY + i * 40}" font-family="${FONT_STACK}" font-size="27" fill="${c.muted}">${esc(line)}</text>`,
    );
  });

  // 底部：一条细线 + 左(日期/标签) 右(域名)
  parts.push(
    `<line x1="${textX}" y1="512" x2="${rightX}" y2="512" stroke="${c.hairline}" stroke-width="1"/>`,
    `<text x="${textX}" y="552" font-family="${FONT_STACK}" font-size="24" fill="${c.muted}">${esc(input.footerLeft)}</text>`,
    `<text x="${rightX}" y="552" text-anchor="end" font-family="${FONT_STACK}" font-size="24" fill="${c.accent}">${esc(input.footerRight)}</text>`,
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
