const { resolveUrl } = require("../utils/urlUtils");

function getMetaByName($, name) {
  return $(`meta[name="${name}"]`).attr("content")?.trim() || "";
}

function parseDirectives(...values) {
  const directives = new Set();

  for (const value of values) {
    String(value || "")
      .toLowerCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => directives.add(part));
  }

  return [...directives];
}

function analyzeTechnical($, pageUrl, headers = {}) {
  const robotsMeta = getMetaByName($, "robots");
  const xRobotsTag = String(headers["x-robots-tag"] || headers["X-Robots-Tag"] || "").trim();
  const directives = parseDirectives(robotsMeta, xRobotsTag);
  const directiveSet = new Set(directives);
  const twitter = {};
  const hreflang = $("link[rel='alternate'][hreflang]")
    .map((_, element) => {
      const href = resolveUrl(pageUrl, $(element).attr("href"));
      const lang = ($(element).attr("hreflang") || "").trim();

      if (!href || !lang) {
        return null;
      }

      return {
        href,
        lang,
      };
    })
    .get()
    .filter(Boolean);

  $("meta[name^='twitter:']").each((_, element) => {
    const key = ($(element).attr("name") || "").trim();
    const value = ($(element).attr("content") || "").trim();

    if (key) {
      twitter[key] = value;
    }
  });

  const mixedContentResources = [];

  if (String(pageUrl).startsWith("https://")) {
    const candidateSelectors = [
      ["img[src]", "src"],
      ["script[src]", "src"],
      ["iframe[src]", "src"],
      ["link[rel='stylesheet'][href]", "href"],
    ];

    for (const [selector, attribute] of candidateSelectors) {
      $(selector).each((_, element) => {
        const resourceUrl = resolveUrl(pageUrl, $(element).attr(attribute));

        if (resourceUrl && resourceUrl.startsWith("http://")) {
          mixedContentResources.push(resourceUrl);
        }
      });
    }
  }

  return {
    technical: {
      directives,
      hasNofollow: directiveSet.has("nofollow"),
      hasNoindex: directiveSet.has("noindex"),
      hreflang,
      htmlLang: ($("html").attr("lang") || "").trim(),
      mixedContentResources: [...new Set(mixedContentResources)],
      robotsMeta,
      twitter,
      viewport: getMetaByName($, "viewport"),
      xRobotsTag,
    },
  };
}

module.exports = {
  analyzeTechnical,
};

