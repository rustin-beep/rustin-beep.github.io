import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 文章集合的统一读取口径 —— 单一真相来源
 * ----------------------------------------------------------------------------
 * 首页 / 归档 / 标签 / RSS / llms.txt / 文章页 各自需要"取全集 + 排序"，
 * 统一收在这里，避免五处各写一套后加规则时漏掉一处。
 */

export type Post = CollectionEntry<'posts'>;

/** 归档目录名。判定按**路径段**，所以 `archive/2024/foo.mdx` 也算归档。 */
const ARCHIVE_DIR = 'archive';

/**
 * slug —— URL 的唯一定义处。
 *
 * ★ 只取**文件名**，丢掉目录段。理由不只是好看：
 *   归档是"把文件搬进 archive/ 目录"，如果 slug 里带上目录，那么
 *   **搬一次文件就换一次 URL，所有外链当场烂掉**。丢掉目录段之后，
 *   `posts/foo.mdx` 与 `posts/archive/foo.mdx` 的地址都是 `/posts/foo/`——
 *   归档可以随时做，URL 不变。
 *   代价：文件名之间的层级不再表达 URL 层级；要嵌套路径就写显式 slug。
 *
 * 文件名是中文等非 ASCII 时也能跑（URL 会被转义），但按 §六.1 的约定，
 * 对外发布的文章一律写显式 slug，让地址与文件名彻底解耦。
 */
export function postSlug(post: Post): string {
  if (post.data.slug) return post.data.slug;
  const id = post.id;
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
}

/** 文章页地址。 */
export const postHref = (post: Post): string => `/posts/${postSlug(post)}/`;

/**
 * 是否已归档 —— 判据是**文件在不在 archive/ 目录里**（见 content.config.ts 末尾）。
 * 不读 frontmatter：位置即状态，只有一套真相。
 *
 * ★ 用 `filePath`（源文件绝对路径）而不是 `id`：id 的形态由 loader 决定，
 *   不保证保留目录段；filePath 一定带着完整路径。Windows 上是反斜杠，先归一化。
 */
export function isArchivedPost(post: Post): boolean {
  const p = (post.filePath ?? post.id).replace(/\\/g, '/');
  return p.split('/').slice(0, -1).includes(ARCHIVE_DIR);
}

/** 现存（未归档）——首页与"最新"语义的入口只列这一批。 */
export const isCurrentPost = (post: Post): boolean => !isArchivedPost(post);

/**
 * 全部**已发布**文章，最新在前。含已归档（归档页 / RSS / sitemap 都要它们）。
 * getCollection() 的返回顺序是非确定的（平台依赖）——必须自己 sort。
 */
export async function allPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  assertUniqueSlugs(posts);
  return posts;
}

/**
 * slug 去重 —— fail loud
 *
 * 因为 postSlug 把目录段拍平了，`posts/foo.mdx` 与 `posts/archive/foo.mdx`
 * 会解析成同一个地址。这不是"看不见的取舍"，是**会静默覆盖页面**的事故：
 * 两条路由同名，构建结果取决于顺序，而且不会有任何报错。
 * 所以这里主动查一遍、把两个冲突的文件路径都报出来。
 */
let slugCheckWarned = false;
function assertUniqueSlugs(posts: Post[]): void {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const post of posts) {
    const slug = postSlug(post);
    const where = post.filePath ?? post.id;
    const prev = seen.get(slug);
    if (prev) conflicts.push(`  /posts/${slug}/ ← ${prev} 与 ${where}`);
    else seen.set(slug, where);
  }
  if (conflicts.length > 0) {
    throw new Error(
      [
        'slug 冲突：多篇文章解析出同一个地址（构建会静默互相覆盖，故直接判红）。',
        ...conflicts,
        '修法：给其中一篇写显式 slug，或改文件名。',
      ].join('\n'),
    );
  }
  if (!slugCheckWarned) {
    slugCheckWarned = true;
    console.log(
      `[posts] ${seen.size} 篇已发布文章，slug 唯一性通过（含 ${posts.filter(isArchivedPost).length} 篇已归档）。`,
    );
  }
}

/**
 * 文章页底部的上一篇 / 下一篇。
 *
 * 约定（写死，别再各页各解一套）：
 *   · 上一篇 = **时间上更早**的那篇（列表里排在它后面）
 *   · 下一篇 = **时间上更晚**的那篇（列表里排在它前面）
 * 数组是"最新在前"，所以更早 = i+1、更晚 = i-1。两头自然为 undefined，不产生死链。
 * 已归档的文章照样参与串联——否则从一篇老文走进来就断链了。
 */
export function postNeighbors(posts: Post[], current: Post) {
  const i = posts.findIndex((p) => p.id === current.id);
  if (i < 0) return { older: undefined, newer: undefined };
  return { older: posts[i + 1], newer: posts[i - 1] };
}

/** 按年份分组，年份新→旧，组内保持传入顺序。 */
export function groupByYear(posts: Post[]): [number, Post[]][] {
  const byYear = new Map<number, Post[]>();
  for (const post of posts) {
    const year = post.data.pubDate.getFullYear();
    const bucket = byYear.get(year);
    if (bucket) bucket.push(post);
    else byYear.set(year, [post]);
  }
  return [...byYear.entries()].sort((a, b) => b[0] - a[0]);
}
