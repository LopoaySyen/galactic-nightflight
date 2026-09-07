import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function renderRoute(path, origin = "http://localhost") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request(`${origin}${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<html[^>]*\blang=["']zh-CN["']/i);
  return html;
}

test("renders content navigation and named feature controls without slideshow chrome", async () => {
  const html = await renderRoute("/");
  assert.match(html, /<title>银河夜航<\/title>/);
  assert.match(html, /class="night-home /);
  assert.match(html, /class="nf-star-flight"/);
  assert.match(html, /milky-way-6000\.webp 6000w/);
  assert.match(html, /logo-starboat\.webp/);
  for (const text of ["银河夜航", "空间漫游", "时间推进", "感光与大气", "天体查询", "同一片银河，", "不同的星空。", "星球上", "无需另行授权", "暂停动态效果"]) assert.ok(html.includes(text), text);
  assert.match(html, /href="\/observe"/);
  assert.match(html, /\/brand\/favicon-nightflight-32\.png/);
  assert.match(html, /<a[^>]*aria-label="Switch to English"[^>]*href="\/en"/);
  assert.match(html, /<a href="\/observe" class="nf-enter"/);
  assert.match(html, /<a href="\/observe" class="nf-primary"/);
  assert.match(html, /href="https:\/\/github.com\/LopoaySyen\/galactic-nightflight"/);
  assert.match(html, /MIT 许可证/);
  assert.match(html, /aria-label="首页栏目"/);
  for (const section of ['about', 'features', 'guide', 'open-source']) {
    assert.ok(html.includes(`href="#${section}"`));
    assert.ok(html.includes(`id="${section}"`));
  }
  assert.doesNotMatch(html, /选择主题|暂停自动切换|上一张|下一张|role="carousel"|journey-tabs/);
  assert.equal((html.match(/role="tablist"/g) ?? []).length, 2);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 7);
  for (const image of ['observatory', 'position-jump', 'star-details']) {
    assert.ok(html.includes(`/guide/${image}.jpg`));
  }
  assert.doesNotMatch(html, /class="planetarium-sky"/);
});

test("serves a complete English introduction with language navigation", async () => {
  const html = await renderRoute("/en");
  assert.match(html, /<main[^>]*lang="en"/);
  for (const text of ["Galactic Nightflight", "Page sections", "Travel", "Time", "Atmosphere", "Star finder", "One galaxy.", "Countless skies.", "Make this sky your own.", "no separate author approval"]) assert.ok(html.includes(text), text);
  assert.match(html, /href="\/" hrefLang="zh-CN"/i);
  assert.match(html, /aria-label="Explore features"/);
});

test("renders the full-screen observing platform with navigation and repeatable tutorial", async () => {
  const html = await renderRoute("/observe");
  assert.match(html, /<title>观星平台 · 银河夜航<\/title>/);
  for (const text of ["位置跳转", "看向方向", "锁定中心", "新手教程"]) assert.ok(html.includes(text), text);
  assert.match(html, /role="switch" aria-checked="false"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /class="planetarium-shell"/);
  assert.match(html, /class="planetarium-sky"/);
  assert.match(html, /class="planetarium-topbar"/);
  assert.match(html, /class="planetarium-rail"/);
  assert.match(html, /class="planetarium-statusbar"/);
  assert.match(html, /class="time-console"/);
  assert.match(html, /银河预测天幕/);
  assert.match(html, /三维恒星与尘埃模型/);
  assert.match(html, /银河中心/);
  assert.match(html, /搜索天体/);
  assert.match(html, /盘面上方/);
  assert.match(html, /时间流速/);
  assert.doesNotMatch(html, /<h1[^>]*>\s*先把银河造对/i);
  assert.doesNotMatch(html, /class="hero"/);
  assert.match(html, /\/brand\/nightflight-sky\.webp/);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("renders three logo candidates with original downloads and generation notes", async () => {
  const html = await renderRoute("/logos");
  assert.match(html, /<title>标志候选 · 银河夜航<\/title>/);
  for (const id of ["starboat", "navigation", "starsail"]) {
    assert.ok(html.includes(`/brand/logo-${id}.webp`));
    assert.ok(html.includes(`/brand/logo-${id}.png`));
  }
  assert.match(html, /\/brand\/generation-notes\.json/);
});

test("every linked scientific contract and social image exists in public assets", async () => {
  for (const relativePath of [
    "../public/data/model-manifest.json",
    "../public/data/scientific-artifact.schema.json",
    "../public/data/model-manifest.schema.json",
    "../public/data/validation-receipt.schema.json",
    "../public/data/PHYSICAL_MODEL_AND_DATA_ARCHITECTURE.md",
    "../public/data/bright-star-catalog-source.json",
    "../public/data/yale-bright-stars.csv",
    "../public/data/gaia-dr3-bright-6d-source.json",
    "../public/data/gaia-dr3-bright-6d.bin",
    "../public/brand/nightflight-sky.webp",
    "../public/brand/milky-way-1920.webp",
    "../public/brand/milky-way-4096.webp",
    "../public/brand/milky-way-6000.webp",
    "../public/brand/favicon-nightflight-16.png",
    "../public/brand/favicon-nightflight-32.png",
    "../public/brand/favicon-nightflight.ico",
    "../public/brand/theme-orion.webp",
    "../public/brand/theme-andromeda.webp",
    "../public/legal/LICENSE",
    "../public/legal/NOTICE",
    "../public/brand/logo-starboat.webp",
    "../public/brand/logo-starboat.png",
    "../public/brand/logo-navigation.webp",
    "../public/brand/logo-navigation.png",
    "../public/brand/logo-starsail.webp",
    "../public/brand/logo-starsail.png",
    "../public/brand/generation-notes.json",
    "../public/data/SCIENCE_DISPLAY_UPDATE.md",
    "../public/data/deep-sky-image-sources.json",
    "../public/terrain/planet-terrain-panorama-v2.webp",
    "../public/terrain/basalt-ground-texture-v1.webp",
    "../public/data/terrain-asset-source.json",
  ]) {
    const fileUrl = new URL(relativePath, import.meta.url);
    await access(fileUrl);
    const bytes = await readFile(fileUrl);
    assert.ok(bytes.byteLength > 0, `${relativePath} must not be empty`);
  }
});


test("tab icons resolve on the visiting domain across home and observatory routes", async () => {
  for (const origin of ["https://nightflight.xelope.fun", "https://galactic-sky-physics.blush-eel-3740.chatgpt.site"]) {
    for (const path of ["/", "/en", "/observe"]) {
      const html = await renderRoute(path, origin);
      const links = (html.match(/<link\b[^>]*>/g) ?? []).filter(tag => /rel="(?:icon|shortcut icon|apple-touch-icon)"/.test(tag));
      assert.ok(links.length >= 3, `${origin}${path}: missing icons`);
      for (const tag of links) {
        const href = tag.match(/href="([^"]+)"/)?.[1];
        assert.ok(href, tag);
        const icon = new URL(href, origin);
        assert.equal(icon.origin, origin, `cross-origin icon: ${tag}`);
        assert.equal(icon.searchParams.get("v"), "nightflight-2");
      }
    }
  }
  const source = await readFile(new URL("../public/brand/favicon-nightflight.ico", import.meta.url));
  const root = await readFile(new URL("../public/favicon.ico", import.meta.url));
  const published = await readFile(new URL("../dist/client/favicon.ico", import.meta.url));
  assert.deepEqual(root, source);
  assert.deepEqual(published, source);
  assert.deepEqual([...root.subarray(0, 4)], [0, 0, 1, 0]);
});
