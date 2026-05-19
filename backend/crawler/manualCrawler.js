const { dedupeUrls, normalizeUrl } = require("../utils/urlUtils");

function collectManualUrls({ manualUrls = [], targetUrl }) {
  const normalizedTarget = normalizeUrl(targetUrl);

  return dedupeUrls(
    manualUrls
      .map((url) => normalizeUrl(url, normalizedTarget || undefined))
      .filter(Boolean),
  );
}

module.exports = {
  collectManualUrls,
};

