const ASSET_EXTENSION_PATTERN =
  /\.(?:avif|bmp|css|csv|doc|docx|eot|gif|ico|jpeg|jpg|js|json|map|mp3|mp4|pdf|png|ppt|pptx|rss|svg|ts|txt|webm|webp|woff|woff2|xls|xlsx|xml|zip)$/i;

function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl, baseUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = "";

    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
      parsed.port = "";
    }

    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/") || "/";

    const sortedParams = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    parsed.search = "";

    for (const [key, value] of sortedParams) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function resolveUrl(baseUrl, href) {
  return normalizeUrl(href, baseUrl);
}

function isHttpUrl(rawUrl) {
  return Boolean(normalizeUrl(rawUrl));
}

function getOrigin(rawUrl) {
  const normalized = normalizeUrl(rawUrl);

  if (!normalized) {
    return null;
  }

  return new URL(normalized).origin;
}

function isSameOrigin(firstUrl, secondUrl) {
  const firstOrigin = getOrigin(firstUrl);
  const secondOrigin = getOrigin(secondUrl);

  return Boolean(firstOrigin && secondOrigin && firstOrigin === secondOrigin);
}

function shouldSkipUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);

  if (!normalized) {
    return true;
  }

  const parsed = new URL(normalized);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }

  if (/^(?:javascript:|mailto:|tel:|sms:)/i.test(rawUrl)) {
    return true;
  }

  return ASSET_EXTENSION_PATTERN.test(parsed.pathname);
}

function dedupeUrls(urls, baseUrl) {
  const seen = new Set();
  const deduped = [];

  for (const url of urls || []) {
    const normalized = normalizeUrl(url, baseUrl);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function deriveSitemapUrl(targetUrl) {
  const normalized = normalizeUrl(targetUrl);

  if (!normalized) {
    return null;
  }

  const parsed = new URL(normalized);
  parsed.pathname = "/sitemap.xml";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function toComparableKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isHtmlResponse(headers = {}) {
  const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType === "";
}

module.exports = {
  dedupeUrls,
  deriveSitemapUrl,
  getOrigin,
  isHtmlResponse,
  isHttpUrl,
  isSameOrigin,
  normalizeUrl,
  resolveUrl,
  shouldSkipUrl,
  toComparableKey,
};
