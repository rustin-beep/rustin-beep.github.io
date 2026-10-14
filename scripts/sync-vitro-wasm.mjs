#!/usr/bin/env node
/**
 * sync-vitro —— 把 Vitro 最新 wasm-gc 产物同步进 public/vitro/，
 * 并重算 PostLayout.astro 头注里的指纹（md5 / engine / protocol）。
 *
 * 为什么需要它：博客的 C 运行按钮用的是**钉死**的 wasm 产物（不随 demo
 * 站点线上字节漂移——文章结论按具体引擎行为写，静默换版本会让"点击
 * 复现"与正文对不上）。钉死的代价是更新要显式做，本脚本把"显式"压缩
 * 成一条命令。
 *
 * 用法：
 *   npm run sync-vitro                 # 源默认 D:/code/Vitro
 *   VITRO_REPO=E:/path/Vitro npm run sync-vitro
 *
 * 同步后必须（脚本不代跑，需要 Node 23+ 才能实例化 wasm-gc）：
 *   cd <VITRO_REPO> && node scripts/demo_smoke/main.js   # 期望 168/168
 *   npm run build
 */
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vitroRepo = process.env.VITRO_REPO || 'D:/code/Vitro';
const src = join(vitroRepo, 'moonbit/_build/wasm-gc/release/build/gateway/wasm/wasm.wasm');
const dst = join(root, 'public/vitro/wasm.wasm');
const layout = join(root, 'src/layouts/PostLayout.astro');

if (!existsSync(src)) {
  console.error(
    `[sync-vitro] 找不到产物：${src}\n` +
      '先在 Vitro 仓库构建：cd moonbit && moon build --release --target wasm-gc gateway/wasm'
  );
  process.exit(2);
}

const md5Of = (p) => createHash('md5').update(readFileSync(p)).digest('hex');

const before = existsSync(dst) ? md5Of(dst) : '(不存在)';
copyFileSync(src, dst);
const after = md5Of(dst);
const bytes = statSync(dst).size;
console.log(`[sync-vitro] wasm：${before} -> ${after}（${bytes} 字节）`);
if (before === after) {
  console.log('[sync-vitro] 字节未变——源仓库没重新构建？指纹注释不重复改写。');
  process.exit(0);
}

// 版本号尽量从产物里问出来（需要 Node 23+ 的 js-string builtins 支持）；
// 问不到就只改 md5，engine/protocol 留给人工确认——不猜。
let engineVer = null;
let protoVer = null;
try {
  const mod = new WebAssembly.Module(readFileSync(dst), {
    builtins: ['js-string'],
    importedStringConstants: '_',
  });
  const inst = new WebAssembly.Instance(mod, {});
  engineVer = inst.exports.engine_version();
  protoVer = inst.exports.protocol_version();
} catch {
  console.log('[sync-vitro] 当前 Node 无法实例化 wasm-gc（需 23+）——只更新 md5，engine/protocol 请手工核对头注。');
}

let text = readFileSync(layout, 'utf8');
const FP_RE = /指纹：md5 [0-9a-f]{32} · engine [0-9.]+ · protocol v[0-9.]+/;
if (!FP_RE.test(text)) {
  console.error('[sync-vitro] 在 PostLayout.astro 里找不到指纹注释行——头注结构可能已变，请手工更新。');
  process.exit(3);
}
const replacement = engineVer
  ? `指纹：md5 ${after} · engine ${engineVer} · protocol ${protoVer}`
  : `指纹：md5 ${after} · engine ?? · protocol v??`;
writeFileSync(layout, text.replace(FP_RE, replacement));
console.log(`[sync-vitro] 头注指纹已更新：${replacement}`);
console.log('[sync-vitro] 下一步：cd ' + vitroRepo + ' && node scripts/demo_smoke/main.js（期望 168/168），然后 npm run build。');
