const cheerio = require("cheerio");

const { dedupeUrls, deriveSitemapUrl, isSameOrigin, normalizeUrl } = require("../utils/urlUtils");

async function collectSitemapUrls({ fetchText, sitemapUrl, targetUrl, maxSitemaps = 25 }) {
  const normalizedTarget = normalizeUrl(targetUrl);
  const rootSitemapUrl = normalizeUrl(sitemapUrl || deriveSitemapUrl(normalizedTarget));

  if (!rootSitemapUrl) {
    return [];
  }

  const sitemapQueue = [rootSitemapUrl];
  const visitedSitemaps = new Set();
  const discoveredUrls = [];

  while (sitemapQueue.length > 0 && visitedSitemaps.size < maxSitemaps) {
    const currentSitemap = sitemapQueue.shift();

    if (!currentSitemap || visitedSitemaps.has(currentSitemap)) {
      continue;
    }

    visitedSitemaps.add(currentSitemap);

    try {
      const xml = await fetchText(currentSitemap);
      const $ = cheerio.load(xml, { xmlMode: true });

      $("sitemap > loc").each((_, element) => {
        const nextSitemap = normalizeUrl($(element).text().trim(), currentSitemap);

        if (nextSitemap && !visitedSitemaps.has(nextSitemap)) {
          sitemapQueue.push(nextSitemap);
        }
      });

      $("url > loc").each((_, element) => {
        const pageUrl = normalizeUrl($(element).text().trim(), normalizedTarget);

        if (pageUrl && isSameOrigin(pageUrl, normalizedTarget)) {
          discoveredUrls.push(pageUrl);
        }
      });
    } catch (error) {
      continue;
    }
  }

  return dedupeUrls(discoveredUrls);
}

module.exports = {
  collectSitemapUrls,
};

