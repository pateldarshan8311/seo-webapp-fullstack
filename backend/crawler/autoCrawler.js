const { dedupeUrls, isSameOrigin, normalizeUrl, shouldSkipUrl } = require("../utils/urlUtils");

function collectAutoSeedUrls({ targetUrl }) {
  const normalizedTarget = normalizeUrl(targetUrl);
  return normalizedTarget ? [normalizedTarget] : [];
}

function discoverInternalUrls({ pageRecord, targetUrl }) {
  const normalizedTarget = normalizeUrl(targetUrl);

  if (!normalizedTarget) {
    return [];
  }

  return dedupeUrls(
    (pageRecord.internalLinks || [])
      .map((link) => link.url)
      .filter((url) => url && !shouldSkipUrl(url) && isSameOrigin(url, normalizedTarget)),
  );
}

module.exports = {
  collectAutoSeedUrls,
  discoverInternalUrls,
};

