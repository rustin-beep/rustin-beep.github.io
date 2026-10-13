/**
 * 阅读统计 —— 中文字数 + 英文词数 + 估算阅读时间。
 *
 * 刻意**排除代码块与行内代码**：代码是"看"不是"读"，把 `=>`、`nullptr`、
 * 大括号全算进字数会显著虚高，读起来反而不准（这也是 Medium 等站的做法）。
 * 代价是纯代码长文的时间会被低估——技术博客里这个取舍更划算。
 *
 * 速率取常见口径：中文 400 字/分、英文 250 词/分。
 */
export interface ReadingStats {
  /** 中日韩统一表意文字字数 */
  cjk: number;
  /** 拉丁词数（数字算一个词） */
  words: number;
  /** 估算分钟数，至少 1 */
  minutes: number;
}

export function readingStats(markdown: string): ReadingStats {
  const text = markdown
    // 围栏代码块
    .replace(/```[\s\S]*?```/g, ' ')
    // 行内代码
    .replace(/`[^`]*`/g, ' ')
    // 标题记号、强调、链接、列表、引用
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/[*_~>[\]]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []).length;

  const minutes = Math.max(1, Math.ceil(cjk / 400 + words / 250));

  return { cjk, words, minutes };
}

/** 千分位，给 1234 → "1,234" */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
