function getMetaContent($, selector) {
  return $(selector).attr("content")?.trim() || "";
}

function analyzeMeta($) {
  const openGraph = {};

  $('meta[property^="og:"]').each((_, element) => {
    const property = $(element).attr("property");
    const content = $(element).attr("content")?.trim() || "";

    if (property) {
      openGraph[property] = content;
    }
  });

  return {
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || "",
    description: getMetaContent($, 'meta[name="description"]'),
    keywords: getMetaContent($, 'meta[name="keywords"]'),
    openGraph,
    title: $("title").first().text().trim(),
  };
}

module.exports = {
  analyzeMeta,
};

