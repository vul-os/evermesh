#!/usr/bin/env node
/**
 * Verifies apps/site in a real browser.
 *
 *   node tools/site/check.mjs            # check
 *   node tools/site/check.mjs --shots    # also write site screenshots
 *
 * Asserts, for the landing page and for every route in the docs viewer:
 *
 *   - zero console errors and zero page errors
 *   - zero failed network requests (a missing font/doc/asset fails here)
 *   - every internal link resolves to a real file or a real in-page target
 *   - the docs viewer actually renders each document (no error box, real
 *     headings) rather than silently showing "Loading…"
 *
 * Serves apps/site over a throwaway HTTP server, because the viewer fetches
 * markdown and file:// would block it.
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const siteDir = path.join(repo, "apps", "site");
const shotsDir = path.join(siteDir, "screenshots");
const withShots = process.argv.includes("--shots");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const server = http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(siteDir, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(siteDir) || !fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

const browser = await chromium.launch();

function watch(page, where) {
  page.on("console", (m) => {
    if (m.type() === "error") fail(where, `console error — ${m.text()}`);
  });
  page.on("pageerror", (e) => fail(where, `page error — ${e.message}`));
  page.on("requestfailed", (r) => fail(where, `request failed — ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) fail(where, `HTTP ${r.status()} — ${r.url()}`);
  });
}

/**
 * Every same-origin link on the page must resolve: a file that exists, an
 * element id that exists, or — on the docs viewer, where the hash is the
 * route — a slug the viewer knows how to load.
 */
async function checkLinks(page, where, routes = new Set()) {
  const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  for (const href of new Set(links)) {
    if (/^(https?:|mailto:)/i.test(href)) continue;
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (!id || routes.has(id)) continue;
      const exists = await page.evaluate((x) => !!document.getElementById(x), id);
      if (!exists) fail(where, `dangling in-page link ${href}`);
      continue;
    }
    const [filePart, hash] = href.split("#");
    const file = path.join(siteDir, filePart);
    const target = file.endsWith("/") ? path.join(file, "index.html") : file;
    if (!fs.existsSync(target)) {
      fail(where, `broken link ${href}`);
      continue;
    }
    // `docs.html#001-kernel` from the landing page: the fragment must be a
    // route the viewer actually serves.
    if (hash && filePart.endsWith("docs.html") && !docRoutes.has(hash)) {
      fail(where, `link to unknown docs route ${href}`);
    }
  }
}

/** slugs the docs viewer declares; filled in once docs.html has loaded */
const docRoutes = new Set();

// The landing page links into docs routes, so learn the route table first.
{
  const probe = await browser.newPage();
  await probe.goto(`${base}/docs.html`, { waitUntil: "domcontentloaded" });
  await probe.waitForSelector(".docs-nav a");
  for (const slug of await probe.$$eval(".docs-nav a", (as) => as.map((a) => a.dataset.slug))) {
    docRoutes.add(slug);
  }
  await probe.close();
}

// ---------------------------------------------------------------- landing
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, colorScheme: scheme });
  watch(page, `index.html (${scheme})`);
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await checkLinks(page, `index.html (${scheme})`);

  const h1 = (await page.textContent("h1")) ?? "";
  if (!h1.includes("substrate")) fail(`index.html (${scheme})`, "hero headline missing");
  const usedFont = await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
  if (!/Syne/.test(usedFont)) fail(`index.html (${scheme})`, `display font not applied (${usedFont})`);

  if (withShots) {
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: path.join(shotsDir, `site-${scheme}.png`) });
  }
  await page.close();
}

// ------------------------------------------------------------------- docs
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, colorScheme: "dark" });
watch(page, "docs.html");
await page.goto(`${base}/docs.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

const slugs = await page.$$eval(".docs-nav a", (as) => as.map((a) => a.dataset.slug));
if (slugs.length < 15) fail("docs.html", `expected the full doc set, saw ${slugs.length}`);

for (const slug of slugs) {
  await page.evaluate((s) => {
    location.hash = "#" + s;
  }, slug);
  await page.waitForFunction(
    (s) => document.querySelector(`.docs-nav a[data-slug="${s}"]`)?.classList.contains("active"),
    slug,
  );
  await page.waitForFunction(() => {
    const el = document.getElementById("content");
    return el && el.textContent.trim() !== "Loading…" && el.children.length > 0;
  });
  const state = await page.evaluate(() => ({
    error: !!document.querySelector(".docs-error"),
    headings: document.querySelectorAll("#content h1, #content h2").length,
    text: document.getElementById("content").textContent.trim().length,
  }));
  if (state.error) fail("docs.html", `#${slug} failed to load`);
  if (!state.headings) fail("docs.html", `#${slug} rendered no headings`);
  if (state.text < 400) fail("docs.html", `#${slug} rendered only ${state.text} chars`);
}

await checkLinks(page, "docs.html", docRoutes);
if (withShots) {
  fs.mkdirSync(shotsDir, { recursive: true });
  await page.evaluate(() => {
    location.hash = "#001-kernel";
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, "docs-dark.png") });
}
await page.close();

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`site OK — landing (dark + light) and ${slugs.length} doc routes, no console errors, no broken links`);
