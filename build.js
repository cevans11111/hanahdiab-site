#!/usr/bin/env node
// Builds hanahdiab.com into ./dist (or $OUT). No dependencies: just `node build.js`.
//
//   content/news/*.md      one file per news post
//   content/artwork/*.md   one file per artwork (type: painting | drawing | sculpture)
//   content/pages/*.md     resume.md, statement.md
//   public/                copied as-is (images, style.css, _redirects, favicon, admin config)
//   site.config.json       site-wide settings (contact form endpoint)
//
// PREVIEW=1 makes every folder link point at .../index.html so the site can be browsed
// from a plain file host with no server (used for private previews).

const fs = require("fs");
const path = require("path");
const { pimp, plainText } = require("./lib/pimp");
const { sortKey, formatDate, formatTime } = require("./lib/dates");

const ROOT = __dirname;
const OUT = path.resolve(ROOT, process.env.OUT || "dist");
const PREVIEW = !!process.env.PREVIEW;
// NOINDEX=1 builds a test copy that search engines are told to ignore (used for the pre-launch test site)
const NOINDEX = PREVIEW || !!process.env.NOINDEX;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const YEAR = new Date().getFullYear();

// start from a clean output folder with the static files in place; pages are written on top
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });

// ---------- content loading ----------
function scalar(v) {
  v = v.trim();
  if (v === "" || v === "null" || v === "~") return "";
  if (v[0] === '"') { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
  if (v[0] === "'") return v.slice(1, -1).replace(/''/g, "'");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function readMd(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = {};
  if (m) {
    let key = null;
    for (const line of m[1].split("\n")) {
      const k = line.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
      if (k) { key = k[1]; data[key] = /^[>|][+-]?$/.test(k[2].trim()) ? "" : scalar(k[2]); }
      else if (key && /^\s+\S/.test(line) && typeof data[key] === "string") {
        data[key] = (data[key] ? data[key] + " " : "") + scalar(line.trim());
      }
    }
  }
  return { data, body: (m ? m[2] : raw).trim() };
}

function loadDir(dir) {
  const full = path.join(ROOT, "content", dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.endsWith(".md")).map((f) => {
    const { data, body } = readMd(path.join(full, f));
    return { slug: path.basename(f, ".md"), ...data, body };
  });
}

const imgPath = (v) => "images/" + String(v || "").replace(/^\/?(public\/)?(images\/)?/, "");

// sharp (image resizing) is optional: without it, pictures are copied as uploaded.
let sharp = null;
try { sharp = require("sharp"); } catch (e) { console.warn("  sharp is not installed: pictures are published at their original size"); }
const THUMB_DIR = "images/thumbs/";
const thumbJobs = [];   // artworks with no thumbnail of their own get a small square one made from the large image

const news = loadDir("news")
  .map((n) => ({ ...n, title: String(n.title || "").trim() }))
  .sort((a, b) => sortKey(b.date) - sortKey(a.date));

const SECTIONS = {
  painting: { dir: "paintings", name: "Paintings", heading: "gallery-painting.gif" },
  drawing: { dir: "drawings", name: "Drawings", heading: "gallery-drawing.gif" },
  sculpture: { dir: "sculptures", name: "Sculptures", heading: "gallery-sculpture.gif" },
};
const artwork = loadDir("artwork")
  .filter((a) => a.published !== false && SECTIONS[a.type])
  .sort((a, b) => (Number(b.position) || 0) - (Number(a.position) || 0) || (Number(a.legacy_id) || 0) - (Number(b.legacy_id) || 0));

const thumbSrc = (a) => (a.thumb ? imgPath(a.thumb) : sharp ? THUMB_DIR + a.slug + ".jpg" : imgPath(a.image));
for (const a of artwork) if (!a.thumb && sharp) thumbJobs.push({ from: imgPath(a.image), to: THUMB_DIR + a.slug + ".jpg" });

const pages = {};
for (const p of loadDir("pages")) pages[p.slug] = p;

// ---------- helpers ----------
const h = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rootFor = (depth) => (depth === 0 ? "./" : "../".repeat(depth));
const written = [];

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written.push(rel);
}

const NAV = [
  { href: "news/", label: "News", key: "news" },
  { href: "paintings/", label: "Paintings", key: "painting" },
  { href: "drawings/", label: "Drawings", key: "drawing" },
  { href: "sculptures/", label: "Sculptures", key: "sculpture" },
  { href: "resume/", label: "Resume", key: "resume" },
  { href: "statement/", label: "Statement", key: "statement" },
  { href: "contact/", label: "Contact", key: "contact" },
];

// ---------- page shell ----------
function shell({ depth, title, desc, active, body, absoluteRoot, canonical }) {
  const root = absoluteRoot ? "/" : rootFor(depth);
  const link = (p) => root + (PREVIEW && !absoluteRoot && p === "" ? "home.html" : p + (PREVIEW && !absoluteRoot && p.endsWith("/") ? "index.html" : ""));
  const nav = NAV.map((n) => `<a class="${n.key === active ? "navon" : "nav"}" href="${link(n.href)}">${n.label}</a>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${h(desc)}">
${NOINDEX ? '<meta name="robots" content="noindex">' : canonical ? `<link rel="canonical" href="${h(cfg.siteUrl + canonical)}">` : ""}
<title>Hanah Diab - ${h(title)}</title>
<link rel="icon" href="${root}favicon.ico">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<div id="all">
<div id="left">
<a href="${link("")}"><img src="${root}images/hanah-diab.gif" alt="Hanah Diab"></a>
<div class="nav-links">
${nav}
</div>
<div id="navbottom" class="mini" style="margin-top:10px">
<b>&copy;${YEAR}</b><br>
No content from this site<br>
may be reproduced without<br>
consent from Hanah Diab.
<div class="break5 mini">Original design by Andrew Tibbetts</div>
</div>
<img class="hanger" src="${root}images/navhanger.gif" alt="">
</div>
<div id="right">
${body}
</div>
</div>
</body>
</html>
`;
}

const L = (depth) => {
  const root = rootFor(depth);
  return (p) => root + (PREVIEW && p === "" ? "home.html" : p + (PREVIEW && p.endsWith("/") ? "index.html" : ""));
};

// ---------- news ----------
function newsNav(depth, which) {
  const link = L(depth);
  if (which === "archive")
    return `<div class="newsblockthin"><span>&laquo; <a href="${link("news/")}">Current News</a></span><span class="here">News Archive &raquo;</span></div>`;
  if (which === "detail")
    return `<div class="newsblockthin"><span>&laquo; <a href="${link("news/")}">Current News</a></span><span><a href="${link("news/archive/")}">News Archive</a> &raquo;</span></div>`;
  return `<div class="newsblockthin"><span class="here">&laquo; Current News</span><span><a href="${link("news/archive/")}">News Archive</a> &raquo;</span></div>`;
}

function newsBlock(n, depth) {
  const link = L(depth);
  const t = formatTime(n.date);
  return `<div class="newsblock"><div class="newsrow">
<div class="newsmeta">
<div class="headline"><a href="${link("news/" + n.slug + "/")}">${h(n.title)}</a></div>
<div class="break10">${formatDate(n.date)}${t ? " at " + t : ""}</div>
</div>
<div class="newsbody">${pimp(n.body, rootFor(depth))}</div>
</div></div>`;
}

// news index (latest 5)
write("news/index.html", shell({
  depth: 1, title: "News", active: "news", canonical: "/news/",
  desc: "Read news blogs from the artist Hanah Diab",
  body: newsNav(1, "current") + "\n" + news.slice(0, 5).map((n) => newsBlock(n, 1)).join("\n"),
}));

// archive
write("news/archive/index.html", shell({
  depth: 2, title: "News Archive", active: "news", canonical: "/news/archive/",
  desc: "Read past news blogs from the artist Hanah Diab",
  body: newsNav(2, "archive") + "\n" + news.map((n) => {
    const t = formatTime(n.date);
    return `<div class="archive-row"><div class="when mini">${formatDate(n.date)}${t ? " at " + t : ""}</div><div class="big"><a href="${L(2)("news/" + n.slug + "/")}">${h(n.title)}</a></div></div>`;
  }).join("\n"),
}));

// each post
for (const n of news) {
  write(`news/${n.slug}/index.html`, shell({
    depth: 2, title: n.title, active: "news", canonical: `/news/${n.slug}/`,
    desc: plainText(n.body, 150) || "News from the artist Hanah Diab",
    body: newsNav(2, "detail") + "\n" + newsBlock(n, 2),
  }));
}

// ---------- galleries ----------
function thumbRow(items, sec, depth, selectedSlug) {
  const link = L(depth);
  return `<div class="thumbs">` + items.map((a) =>
    `<div class="thumb${a.slug === selectedSlug ? " on" : ""}"><a href="${link(sec.dir + "/" + a.slug + "/")}"><img src="${rootFor(depth)}${thumbSrc(a)}" loading="lazy" width="40" height="40" alt="${h(a.title)}" title="${h(a.title)}"></a></div>`
  ).join("") + `</div>`;
}

for (const [type, sec] of Object.entries(SECTIONS)) {
  const items = artwork.filter((a) => a.type === type);
  write(`${sec.dir}/index.html`, shell({
    depth: 1, title: sec.name, active: type, canonical: `/${sec.dir}/`,
    desc: "See photos and images of artwork of artist Hanah Diab",
    body: `${thumbRow(items, sec, 1)}<div class="break15"><img src="${rootFor(1)}images/${sec.heading}" alt="${sec.name}"></div>`,
  }));
  for (const a of items) {
    write(`${sec.dir}/${a.slug}/index.html`, shell({
      depth: 2, title: `${a.title} - ${sec.name}`, active: type, canonical: `/${sec.dir}/${a.slug}/`,
      desc: plainText(`${a.title}. ${a.body}`, 150),
      body: `${thumbRow(items, sec, 2, a.slug)}
<div class="artwork">
<div class="subline">${pimp(a.title, rootFor(2))}&nbsp;<span class="mini">${h(a.year || "")}</span></div>
<div class="break5"><img src="${rootFor(2)}${imgPath(a.image)}" alt="${h(a.title)}"></div>
<div class="caption">${pimp(a.body, rootFor(2))}</div>
</div>`,
    }));
  }
}

// ---------- resume / statement ----------
for (const [key, desc] of [["resume", "History bio and resume curriculum vitae info on artist Hanah Diab"], ["statement", "Artist Statement of artist Hanah Diab"]]) {
  const p = pages[key] || { body: "" };
  write(`${key}/index.html`, shell({
    depth: 1, title: key[0].toUpperCase() + key.slice(1), active: key, desc, canonical: `/${key}/`,
    body: `<div id="${key}">${pimp(p.body, rootFor(1))}</div>`,
  }));
}

// ---------- contact ----------
const endpoint = cfg.contactEndpoint || "";
write("contact/index.html", shell({
  depth: 1, title: "Contact", active: "contact", canonical: "/contact/",
  desc: "Online email form to contact Hanah Diab",
  body: `<form class="contact" id="contact-form" method="post" action="${h(endpoint)}">
<textarea name="message" required aria-label="Message"></textarea>
<p>Name:<br><input type="text" name="name" size="30" required></p>
<p>Email:<br><input type="email" name="email" size="30" required></p>
<input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
<p><input type="submit" value="Submit"></p>
<div class="note" id="contact-note" role="status"></div>
</form>
<script>
(function () {
  var form = document.getElementById("contact-form");
  var note = document.getElementById("contact-note");
  var endpoint = ${JSON.stringify(endpoint)};
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!endpoint) { note.textContent = "Preview only: the contact form is not connected yet."; return; }
    var data = new FormData(form);
    note.textContent = "Sending…";
    fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); form.reset(); note.textContent = "Your Message Has Been Sent!"; })
      .catch(function () { note.textContent = "Sorry, that did not send. Please try again later."; });
  });
})();
</script>`,
}));

// ---------- splash + 404 ----------
write(PREVIEW ? "home.html" : "index.html", `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Home of artist Hanah Diab">
${NOINDEX ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${h(cfg.siteUrl)}/">`}
<title>Hanah Diab - Home</title>
<link rel="icon" href="./favicon.ico">
<link rel="stylesheet" href="./style.css">
</head>
<body>
<div class="splash"><a href="./news/${PREVIEW ? "index.html" : ""}"><img src="./images/splash.gif" alt="Hanah Diab"></a></div>
</body>
</html>
`);

write("404.html", shell({
  depth: 0, absoluteRoot: true, title: "Page not found", active: "", desc: "Page not found",
  body: `<div class="headline">Page not found</div><p>That page doesn't exist (any more). Try the <a href="/news/">news</a> or one of the galleries on the left.</p>`,
}));

// ---------- sitemap, robots, summary ----------
if (NOINDEX && !PREVIEW) {
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nDisallow: /\n`);
} else if (!PREVIEW) {
  const urls = written.filter((f) => f.endsWith("index.html")).map((f) => "/" + f.replace(/index\.html$/, ""));
  fs.writeFileSync(path.join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${cfg.siteUrl}${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
}

// warn about images the content points at that are not in public/images
const missing = new Set();
for (const a of artwork) for (const f of [a.image, a.thumb].filter(Boolean)) if (!fs.existsSync(path.join(ROOT, "public", imgPath(f)))) missing.add(imgPath(f));
for (const n of news) for (const m of n.body.matchAll(/\[image[a-z]*:([^\]]+)\]/g)) if (!fs.existsSync(path.join(ROOT, "public", m[1].trim().replace(/^(\.\/)?public\//, "")))) missing.add(m[1].trim().replace(/^(\.\/)?public\//, "") + "  (in news: " + n.slug + ")");
async function optimizeImages() {
  if (!sharp) return;
  const MAX_W = 1200, BIG = 600 * 1024;
  let shrunk = 0, saved = 0;
  const dir = path.join(OUT, "images");
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const file = path.join(dir, f), before = fs.statSync(file).size;
    const meta = await sharp(file).metadata();
    const isThumb = artwork.some((a) => a.thumb && imgPath(a.thumb) === "images/" + f);
    const tooBig = isThumb ? meta.width > 240 || before > 80 * 1024 : meta.width > MAX_W || before > BIG;
    if (!tooBig) continue;
    // .rotate() applies the phone's orientation and drops hidden metadata such as GPS location
    const img = sharp(file).rotate();
    const out = isThumb
      ? await img.resize(120, 120, { fit: "cover" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
      : /\.png$/i.test(f)
        ? await img.resize({ width: MAX_W, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
        : await img.resize({ width: MAX_W, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    if (out.length < before) { fs.writeFileSync(file, out); shrunk++; saved += before - out.length; }
  }
  fs.mkdirSync(path.join(OUT, THUMB_DIR), { recursive: true });
  for (const j of thumbJobs) {
    const src = path.join(ROOT, "public", j.from);
    if (!fs.existsSync(src)) continue;
    await sharp(src).rotate().resize(120, 120, { fit: "cover" }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, j.to));
  }
  console.log(`  Pictures: ${shrunk} resized (saved ${(saved / 1048576).toFixed(1)} MB), ${thumbJobs.length} thumbnails made`);
}

console.log(`Built ${written.length} pages -> ${path.relative(process.cwd(), OUT) || "."}${PREVIEW ? " (preview mode)" : ""}`);
console.log(`  ${news.length} news posts, ${artwork.length} artworks`);
if (missing.size) console.warn("  Missing image files:\n   - " + [...missing].join("\n   - "));

optimizeImages().catch((e) => { console.error("Picture optimizing failed:", e.message); process.exitCode = 1; });
