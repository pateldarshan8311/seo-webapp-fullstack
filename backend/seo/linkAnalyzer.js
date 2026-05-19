const { isSameOrigin, resolveUrl, shouldSkipUrl } = require("../utils/urlUtils");

function analyzeLinks($, pageUrl, siteOrigin) {
  const internalSeen = new Set();
  const externalSeen = new Set();
  const internalLinks = [];
  const externalLinks = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const resolvedUrl = resolveUrl(pageUrl, href);

    if (!resolvedUrl || shouldSkipUrl(resolvedUrl)) {
      return;
    }

    const linkRecord = {
      rel: ($(element).attr("rel") || "").trim(),
      target: ($(element).attr("target") || "").trim(),
      text: $(element).text().replace(/\s+/g, " ").trim(),
      url: resolvedUrl,
    };

    if (isSameOrigin(resolvedUrl, siteOrigin)) {
      if (!internalSeen.has(resolvedUrl)) {
        internalSeen.add(resolvedUrl);
        internalLinks.push(linkRecord);
      }

      return;
    }

    if (!externalSeen.has(resolvedUrl)) {
      externalSeen.add(resolvedUrl);
      externalLinks.push(linkRecord);
    }
  });

  return {
    externalLinks,
    internalLinks,
    thirdPartyUrls: externalLinks.map((link) => link.url),
  };
}

module.exports = {
  analyzeLinks,
};

