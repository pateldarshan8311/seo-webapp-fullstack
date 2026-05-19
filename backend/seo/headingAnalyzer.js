function collectHeadingText($, selector) {
  return $(selector)
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
}

function analyzeHeadings($) {
  return {
    h1: collectHeadingText($, "h1"),
    h2: collectHeadingText($, "h2"),
  };
}

module.exports = {
  analyzeHeadings,
};

