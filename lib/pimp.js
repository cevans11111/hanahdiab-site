// Renders the text format Hanah already knows from her old admin page:
//   [b]bold[/b]  [i]italic[/i]  [u]underline[/u]  [link:URL]text[/link]
//   [image:images/pic.jpg]  [imageleft:...]  [imageright:...]  [color:CC0000]text[/color]
// Plain text is HTML-escaped, line breaks are kept. Port of the old PHP PimpItOut().

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(u, root) {
  const t = u.trim();
  if (/^javascript:/i.test(t)) return "#";
  if (/^(https?:|mailto:|#|\/)/i.test(t)) return t;
  // relative paths in posts (e.g. images/pic.jpg) are written from the site root
  if (/^[a-z0-9_\-./%]+$/i.test(t)) return (root || "") + t.replace(/^\.\//, "");
  return "#";
}

function pimp(raw, root) {
  let p = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").trim();
  p = esc(p);
  p = p.replace(/\n/g, "<br />\n");
  p = p
    .replace(/\[b\]/g, "<b>").replace(/\[\/b\]/g, "</b>")
    .replace(/\[u\]/g, "<u>").replace(/\[\/u\]/g, "</u>")
    .replace(/\[i\]/g, "<i>").replace(/\[\/i\]/g, "</i>")
    .replace(/\[ \]/g, "&nbsp;");
  p = p.replace(/\[image:([^\]]+)\]/g, (_, s) => `<img src="${safeUrl(s, root)}" alt="" />`);
  p = p.replace(/\[imageleft:([^\]]+)\]/g, (_, s) => `<img class="imgleft" src="${safeUrl(s, root)}" alt="" />`);
  p = p.replace(/\[imageright:([^\]]+)\]/g, (_, s) => `<img class="imgright" src="${safeUrl(s, root)}" alt="" />`);
  p = p.replace(/\[color:[ ]*#*([a-zA-Z0-9]+)\]([\s\S]*?)\[\/color\]/g, '<span style="color: #$1">$2</span>');
  p = p.replace(/\[link:[ ]*([^\]]+)\]([\s\S]*?)\[\/link\]/g, (_, u, t) => `<a target="_blank" rel="noopener" href="${safeUrl(u, root)}">${t}</a>`);
  return p;
}

// text with the tokens removed, for meta descriptions and tooltips
function plainText(raw, max) {
  let t = String(raw == null ? "" : raw)
    .replace(/\[(image|imageleft|imageright):[^\]]*\]/g, "")
    .replace(/\[link:[^\]]*\]/g, "").replace(/\[\/link\]/g, "")
    .replace(/\[color:[^\]]*\]/g, "").replace(/\[\/color\]/g, "")
    .replace(/\[\/?[biu]\]/g, "")
    .replace(/\s+/g, " ").trim();
  if (max && t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
  return t;
}

module.exports = { pimp, plainText };
