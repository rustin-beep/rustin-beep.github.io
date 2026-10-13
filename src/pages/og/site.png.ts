import { renderOgCard } from '../../lib/og-card';
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  GITHUB_HANDLE,
} from '../../site.config';

/**
 * `/og/site.png` —— 站点默认分享卡片（1200×630）
 *
 * 首页 / 关于 / 归档 / 标签 / 搜索 / 404 都用它；文章页有自己一张
 * （见 ./[slug].png.ts）。两者共用 src/lib/og-card.ts 的绘制。
 */
export async function GET() {
  const png = await renderOgCard({
    site: SITE_DESCRIPTION,
    title: SITE_NAME,
    description: '',
    footerLeft: `@${GITHUB_HANDLE}`,
    footerRight: new URL(SITE_URL).host,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
