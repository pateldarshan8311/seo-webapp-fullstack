function analyzeContent($) {
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const words = bodyText ? bodyText.split(" ").filter(Boolean) : [];
  const paragraphs = $("p")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  return {
    contentStats: {
      paragraphCount: paragraphs.length,
      readingTimeMinutes: words.length ? Math.max(1, Math.ceil(words.length / 200)) : 0,
      textExcerpt: bodyText.slice(0, 220),
      wordCount: words.length,
    },
  };
}

module.exports = {
  analyzeContent,
};

