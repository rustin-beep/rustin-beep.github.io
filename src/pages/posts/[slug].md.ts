import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '../../site.config';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.data.slug ?? post.id },
    props: { post },
  }));
}

/**
 * `/posts/<slug>.md` —— 文章的**原始 Markdown**。
 *
 * 给 agent / LLM 直接取纯文本用：无 HTML、无导航、无样式、无代码块机框，
 * 省掉"抓 HTML → 去标签 → 去导航"这一整套。这也是 llms.txt 里每篇都挂
 * 原始 Markdown 链接的原因。
 *
 * 头部补一份最小 frontmatter：把 canonical 地址写进去，
 * 这样脱离上下文单看这个文件也知道它的正式版在哪。
 */
export async function GET({ props }: APIContext) {
  const { post } = props;
  const slug = post.data.slug ?? post.id;
  const canonical = new URL(`/posts/${slug}/`, SITE_URL).toString();

  const head = [
    '---',
    `title: ${JSON.stringify(post.data.title)}`,
    `pubDate: ${post.data.pubDate.toISOString().slice(0, 10)}`,
  ];
  if (post.data.updatedDate) {
    head.push(`updatedDate: ${post.data.updatedDate.toISOString().slice(0, 10)}`);
  }
  if (post.data.tags?.length) {
    head.push(`tags: [${post.data.tags.join(', ')}]`);
  }
  head.push(`canonical: ${canonical}`, '---', '');

  // MDX 里的 `import X from '...'` 是 MDX 专用语法，脱离站点上下文纯属噪声，
  // 且那个相对路径在 .md 里指向不存在的东西。取正文时剔掉。
  const body = (post.body ?? '')
    .split('\n')
    .filter((line: string) => !/^\s*import\s+.*\s+from\s+['"][^'"]+['"];?\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return new Response([...head, body].join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
