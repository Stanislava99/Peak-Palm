// Tells Bing (and other IndexNow search engines such as Yandex, Seznam and Naver) that the site's pages
// changed, so they recrawl them within hours instead of weeks. Google does not use IndexNow.
// Run after a production deploy:  npm run indexnow
// Optional: SITE_URL=https://seaandskivillas.com npm run indexnow
//
// The key below must match the file public/<key>.txt, which proves to the search engines that we own the site.
const KEY = "8c5bd1bfc5c5451095df7f6dca2fc748";
const site = (process.env.SITE_URL || "https://seaandskivillas.com").replace(/\/$/, "");
const host = new URL(site).host;

const keyRes = await fetch(`${site}/${KEY}.txt`);
const keyText = keyRes.ok ? (await keyRes.text()).trim() : "";
if (keyText !== KEY) {
  console.error(`The key file ${site}/${KEY}.txt is missing or wrong (HTTP ${keyRes.status}). Deploy first, then run this again.`);
  process.exit(1);
}

const sitemapRes = await fetch(`${site}/sitemap.xml`);
if (!sitemapRes.ok) {
  console.error(`Could not read ${site}/sitemap.xml (HTTP ${sitemapRes.status}).`);
  process.exit(1);
}
const xml = await sitemapRes.text();
const urlList = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
  .map((m) => m[1])
  .filter((url) => new URL(url).host === host);
if (urlList.length === 0) {
  console.error("The sitemap has no URLs for this host.");
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
});
// 200 = accepted, 202 = accepted and the key is still being checked.
if (res.status === 200 || res.status === 202) {
  console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${res.status}):\n  ${urlList.join("\n  ")}`);
} else {
  console.error(`IndexNow answered HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
