import type { APIContext } from 'astro';
import { renderOgCard } from '../../lib/og-card';
import { allPublishedPosts, postSlug, type Post } from '../../lib/posts';
import { SITE_NAME, SITE_URL } from '../../site.config';

/**
 * `/og/<slug>.png` —— 每篇文章一张 1200×630 分享卡片。
 *
 * 构建期烘成静态 PNG（与文章页同批），运行时不跑任何东西；
 * 卡片内容取自 frontmatter，所以改标题/摘要后重新构建即自动更新——
 * 不存在"忘了重新导图"的第二真相源。
 */
export async function getStaticPaths() {
  const posts = await allPublishedPosts();
  return posts.map((post) => ({
    params: { slug: postSlug(post) },
    props: { post },
  }));
}

export async function GET({ props }: APIContext) {
  const post = props.post as Post;
  const day = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(post.data.pubDate);

  const png = await renderOgCard({
    site: SITE_NAME,
    title: post.data.title,
    description: post.data.description,
    footerLeft: [day, ...(post.data.tags ?? [])].join(' · '),
    footerRight: new URL(SITE_URL).host,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
