function collectTypes(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTypes(entry));
  }

  if (typeof value === "object") {
    const ownTypes = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]].filter(Boolean);
    const graphTypes = Array.isArray(value["@graph"]) ? value["@graph"].flatMap((entry) => collectTypes(entry)) : [];
    return [...ownTypes, ...graphTypes];
  }

  return [];
}

function analyzeStructuredData($) {
  const items = [];
  let invalidItems = 0;

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).html()?.trim();

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const types = [...new Set(collectTypes(parsed).map((type) => String(type).trim()).filter(Boolean))];

      items.push({
        rawLength: raw.length,
        types,
        valid: true,
      });
    } catch (error) {
      invalidItems += 1;
    }
  });

  return {
    structuredData: {
      invalidItems,
      items,
      totalItems: items.length + invalidItems,
      types: [...new Set(items.flatMap((item) => item.types))],
      validItems: items.length,
    },
  };
}

module.exports = {
  analyzeStructuredData,
};

