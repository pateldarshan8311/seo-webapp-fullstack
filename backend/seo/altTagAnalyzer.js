const { resolveUrl } = require("../utils/urlUtils");

function analyzeImages($, pageUrl) {
  const images = $("img")
    .map((_, element) => {
      const alt = ($(element).attr("alt") || "").trim();
      const src = resolveUrl(pageUrl, $(element).attr("src")) || $(element).attr("src") || "";

      return {
        alt,
        missingAlt: !alt,
        src,
      };
    })
    .get()
    .filter((image) => image.src);

  const missingAltCount = images.filter((image) => image.missingAlt).length;

  return {
    imageStats: {
      missingAltCount,
      presentAltCount: images.length - missingAltCount,
      totalImages: images.length,
    },
    images,
  };
}

module.exports = {
  analyzeImages,
};

