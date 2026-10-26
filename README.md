# hanahdiab.com

Static rebuild of Hanah Diab's site. No database, no PHP, nothing to patch.
Content lives in plain files; `node build.js` turns them into the pages in `dist/`.

```
content/news/*.md       one file per news post
content/artwork/*.md    one file per artwork (painting | drawing | sculpture)
content/pages/*.md      resume.md, statement.md
public/                 copied as-is: images/, style.css, admin/ (the editor), _redirects
functions/              redirects for the old ?id= addresses (generated, rarely touched)
site.config.json        site-wide settings (contact-form address)
```

Text keeps the formatting Hanah already knows from her old admin page:
`[b]bold[/b]  [i]italic[/i]  [u]underline[/u]  [link:https://…]text[/link]  [color:CC0000]text[/color]  [image:images/pic.jpg]`

## Try it locally

```
node build.js            # writes dist/
npx serve dist           # or: python3 -m http.server --directory dist
```

## Going live (one time)

1. **GitHub:** create a *private* repository (for example `hanahdiab-site`) and push this folder to it.
2. **Cloudflare Pages:** Workers & Pages → Create → Pages → connect the repository.
   Build command `npm install && node build.js`, output directory `dist`. Every save in the editor now rebuilds the site (about a minute).
3. **Editor address:** open `public/admin/config.yml` and set `repo:` to your GitHub `owner/name`.
4. **Contact form:** create a free form at formspree.io that sends to the address that should receive messages,
   then put its URL in `site.config.json` as `contactEndpoint`. (Until then the form shows "not connected yet".)
5. **Domain and email:** see the cut-over checklist below. Do not cancel HostGator before the email step is done.

## How Hanah edits the site

Go to `hanahdiab.com/admin` and sign in with GitHub. The first time on a device:

- she needs a free GitHub account that has been added to the repository (Settings → Collaborators), and
- a *fine-grained personal access token* limited to this one repository with **Contents: Read and write**
  (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained). Paste it on the sign-in screen.

Then: **News** (add or edit posts), **Artwork** (upload an image, choose the gallery, set order, untick "Show on the site" to hide),
**Resume and Statement** (edit the text). Pictures for news posts: add them under the **Media** tab, then write
`[image:images/yourfile.jpg]` in the post. Large photos from a phone should be resized to about 640 pixels wide first.

## Cut-over checklist (domain registered at GoDaddy, DNS currently at HostGator)

1. Deploy to Cloudflare Pages and review the preview address (`*.pages.dev`) first.
2. Add `hanahdiab.com` to Cloudflare (free plan). It copies the existing DNS records; check the list against HostGator's.
3. Email: in Cloudflare → Email → Email Routing, forward her hanahdiab.com mailbox address to her Gmail.
   Remove the old HostGator mail (MX) record at the same time. If she sends *as* her hanahdiab.com address from Gmail,
   re-do Gmail's "Send mail as" setting with Gmail's own server (it currently uses HostGator's).
4. At GoDaddy, change the domain's nameservers to the two Cloudflare gives you.
5. Attach `hanahdiab.com` and `www` to the Pages project (Custom domains). HTTPS is automatic.
6. Click through the live site and old links (`/news.php`, `/artwork.php?gallery=drawing&id=7`).
7. Keep HostGator for a few weeks, then cancel. Download a final backup first.

## Old addresses

`/news.php`, `/artwork.php?gallery=…&id=…`, `/news-detail.php?id=…`, `/resume.php` and the rest redirect to the new pages
(`public/_redirects` and `functions/_middleware.js`). If `legacy_id` values ever change, run `node tools/make-legacy-redirects.js`.
