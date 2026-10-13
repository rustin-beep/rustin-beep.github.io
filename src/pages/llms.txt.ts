import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  GITHUB_HANDLE,
  GITHUB_URL,
} from '../site.config';
import { allPublishedPosts, postSlug, isArchivedPost } from '../lib/posts';

/**
 * `/llms.txt` —— 按 llms.txt 约定（https://llmstxt.org）生成的站点索引。
 *
 * 为什么要有它：这是目前事实上的"给 LLM 的 robots.txt"。
 * agent 抓一个陌生站点时，最省事的路径不是爬 HTML，而是先读 llms.txt
 * 拿到结构化索引。所以这里刻意做到**从集合实时生成**——文章一多，
 * 索引自动跟着变，不存在"忘了更新"的第二真相源。
 *
 * 已归档的文章**保留在索引里但打标**：对 LLM 来说，"这篇过时了"本身是
 * 有效信息，直接删掉反而会让它从别处抓到旧结论却不知道已经过时。
 */
export async function GET() {
  const posts = await allPublishedPosts();

  const abs = (path: string) => new URL(path, SITE_URL).toString();

  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '>',
    '> 本文件按 llms.txt 约定生成，供 LLM / agent 抓取全站索引。',
    '> 每篇文章都提供**原始 Markdown** 版本（无 HTML、无导航、无样式），',
    '> 取纯文本不必解析 DOM。',
    "> 标题带「（已归档）」的文章**不再维护**，结论可能已过时。",
    '',
    '## 文章',
    '',
  ];

  for (const post of posts) {
    const slug = postSlug(post);
    const mark = isArchivedPost(post) ? '（已归档）' : '';
    lines.push(
      `- [${post.data.title}${mark}](${abs(`/posts/${slug}/`)}): ${post.data.description}`,
    );
    lines.push(`  - 原始 Markdown：${abs(`/posts/${slug}.md`)}`);
  }

  lines.push(
    '',
    '## 其他',
    '',
    `- [关于](${abs('/about/')}): 关于本站与作者`,
    `- [归档](${abs('/archive/')}): 按年份归档，分「现存」与「已归档」两组`,
    `- [标签](${abs('/tags/')}): 全部标签`,
    `- [搜索](${abs('/search/')}): 站内搜索`,
    `- [RSS](${abs('/rss.xml')}): 订阅源`,
    `- [Sitemap](${abs('/sitemap-index.xml')})`,
    `- [GitHub](${GITHUB_URL}): @${GITHUB_HANDLE}`,
    '',
  );

  return new Response(lines.join('\n'), {
    // 约定要求 text/plain——不是 text/markdown
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
