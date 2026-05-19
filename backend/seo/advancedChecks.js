const { getOrigin, normalizeUrl, toComparableKey } = require("../utils/urlUtils");

function buildDuplicateValueMap(pages, fieldName) {
  const valueMap = new Map();

  for (const page of pages) {
    const key = toComparableKey(page[fieldName]);

    if (!key) {
      continue;
    }

    const existing = valueMap.get(key) || [];
    existing.push(page.url);
    valueMap.set(key, existing);
  }

  return valueMap;
}

function buildIncomingInternalLinkMap(pages) {
  const pageKeySet = new Set(
    pages
      .map((page) => normalizeUrl(page.finalUrl || page.url) || normalizeUrl(page.url))
      .filter(Boolean),
  );
  const incomingMap = new Map();

  for (const page of pages) {
    for (const link of page.internalLinks || []) {
      const key = normalizeUrl(link.url);

      if (!key || !pageKeySet.has(key)) {
        continue;
      }

      incomingMap.set(key, (incomingMap.get(key) || 0) + 1);
    }
  }

  return incomingMap;
}

function addIssue(issues, issueDetails, issueType, condition, detail) {
  if (!condition) {
    return;
  }

  issues[issueType] = true;
  issueDetails[issueType] = detail;
}

function isRootPage(pageUrl) {
  try {
    return new URL(pageUrl).pathname === "/";
  } catch (error) {
    return false;
  }
}

function analyzeAdvancedChecks(pages, siteUrl) {
  const titleMap = buildDuplicateValueMap(pages, "title");
  const descriptionMap = buildDuplicateValueMap(pages, "description");
  const duplicateTitleUrls = new Set();
  const duplicateDescriptionUrls = new Set();

  for (const urls of titleMap.values()) {
    if (urls.length > 1) {
      for (const url of urls) {
        duplicateTitleUrls.add(url);
      }
    }
  }

  for (const urls of descriptionMap.values()) {
    if (urls.length > 1) {
      for (const url of urls) {
        duplicateDescriptionUrls.add(url);
      }
    }
  }

  const siteOrigin = getOrigin(siteUrl);
  const incomingInternalLinkMap = buildIncomingInternalLinkMap(pages);

  const enhancedPages = pages.map((page) => {
    const pageUrl = page.finalUrl || page.url;
    const canonicalResolved = page.canonical ? normalizeUrl(page.canonical, pageUrl) : null;
    const pageResolved = normalizeUrl(pageUrl);
    const canonicalOrigin = canonicalResolved ? getOrigin(canonicalResolved) : null;
    const redirects = page.redirectChain || [];
    const titleKey = toComparableKey(page.title);
    const descriptionKey = toComparableKey(page.description);
    const duplicateTitleCount = titleKey ? (titleMap.get(titleKey) || []).length : 0;
    const duplicateDescriptionCount = descriptionKey ? (descriptionMap.get(descriptionKey) || []).length : 0;
    const incomingInternalLinkCount = incomingInternalLinkMap.get(pageResolved) || 0;
    const issues = {
      ...page.issues,
      brokenLinks: (page.brokenLinks || []).length > 0,
      canonicalMismatch: Boolean(canonicalResolved && pageResolved && canonicalResolved !== pageResolved),
      crossDomainCanonical: Boolean(canonicalOrigin && siteOrigin && canonicalOrigin !== siteOrigin),
      deepPage: (page.crawlDepth || 0) >= 4,
      descriptionTooLong: (page.descriptionLength || 0) > 160,
      descriptionTooShort: (page.descriptionLength || 0) > 0 && (page.descriptionLength || 0) < 70,
      duplicateDescription: duplicateDescriptionUrls.has(page.url),
      duplicateTitle: duplicateTitleUrls.has(page.url),
      invalidCanonical: Boolean(page.canonical && !canonicalResolved),
      invalidStructuredData: (page.structuredData?.invalidItems || 0) > 0,
      missingAlt: (page.imageStats?.missingAltCount || 0) > 0,
      missingCanonical: !page.canonical,
      missingDescription: !page.description,
      missingH1: (page.headingStats?.h1Count || 0) === 0,
      missingKeywords: !page.keywords,
      missingLang: !page.technical?.htmlLang,
      missingOpenGraph:
        !page.openGraph?.["og:title"] || !page.openGraph?.["og:description"] || !page.openGraph?.["og:image"],
      missingStructuredData: (page.structuredData?.totalItems || 0) === 0,
      missingTitle: !page.title,
      missingTwitterCard: !page.technical?.twitter?.["twitter:card"],
      missingViewport: !page.technical?.viewport,
      mixedContent: (page.technical?.mixedContentResources || []).length > 0,
      multipleH1: (page.headingStats?.h1Count || 0) > 1,
      nofollowDirective: Boolean(page.technical?.hasNofollow),
      noindexDirective: Boolean(page.technical?.hasNoindex),
      orphanPage: !isRootPage(page.url) && incomingInternalLinkCount === 0 && pages.length > 1,
      redirectChain: redirects.length > 2,
      redirected: redirects.length > 1,
      slowResponse: (page.responseTimeMs || 0) > 2500,
      thinContent: (page.wordCount || 0) > 0 && (page.wordCount || 0) < 250,
      titleTooLong: (page.titleLength || 0) > 60,
      titleTooShort: (page.titleLength || 0) > 0 && (page.titleLength || 0) < 30,
    };
    const issueDetails = { ...(page.issueDetails || {}) };

    addIssue(issues, issueDetails, "brokenLinks", issues.brokenLinks, {
      count: page.brokenLinks?.length || 0,
      sample: (page.brokenLinks || []).slice(0, 5).map((link) => link.url),
    });
    addIssue(issues, issueDetails, "canonicalMismatch", issues.canonicalMismatch, {
      canonical: canonicalResolved,
      currentUrl: pageResolved,
    });
    addIssue(issues, issueDetails, "crossDomainCanonical", issues.crossDomainCanonical, {
      canonical: canonicalResolved,
      pageUrl: pageResolved,
    });
    addIssue(issues, issueDetails, "deepPage", issues.deepPage, {
      depth: page.crawlDepth || 0,
    });
    addIssue(issues, issueDetails, "descriptionTooLong", issues.descriptionTooLong, {
      length: page.descriptionLength || 0,
    });
    addIssue(issues, issueDetails, "descriptionTooShort", issues.descriptionTooShort, {
      length: page.descriptionLength || 0,
    });
    addIssue(issues, issueDetails, "duplicateDescription", issues.duplicateDescription, {
      duplicateCount: duplicateDescriptionCount,
      sampleUrls: (descriptionMap.get(descriptionKey) || []).slice(0, 5),
    });
    addIssue(issues, issueDetails, "duplicateTitle", issues.duplicateTitle, {
      duplicateCount: duplicateTitleCount,
      sampleUrls: (titleMap.get(titleKey) || []).slice(0, 5),
    });
    addIssue(issues, issueDetails, "invalidCanonical", issues.invalidCanonical, {
      canonical: page.canonical,
    });
    addIssue(issues, issueDetails, "invalidStructuredData", issues.invalidStructuredData, {
      invalidItems: page.structuredData?.invalidItems || 0,
    });
    addIssue(issues, issueDetails, "missingAlt", issues.missingAlt, {
      count: page.imageStats?.missingAltCount || 0,
      sample: (page.images || [])
        .filter((image) => image.missingAlt)
        .slice(0, 5)
        .map((image) => image.src),
    });
    addIssue(issues, issueDetails, "missingCanonical", issues.missingCanonical, {});
    addIssue(issues, issueDetails, "missingDescription", issues.missingDescription, {});
    addIssue(issues, issueDetails, "missingH1", issues.missingH1, {});
    addIssue(issues, issueDetails, "missingKeywords", issues.missingKeywords, {});
    addIssue(issues, issueDetails, "missingLang", issues.missingLang, {});
    addIssue(issues, issueDetails, "missingOpenGraph", issues.missingOpenGraph, {
      missingFields: ["og:title", "og:description", "og:image"].filter((field) => !page.openGraph?.[field]),
    });
    addIssue(issues, issueDetails, "missingStructuredData", issues.missingStructuredData, {});
    addIssue(issues, issueDetails, "missingTitle", issues.missingTitle, {});
    addIssue(issues, issueDetails, "missingTwitterCard", issues.missingTwitterCard, {});
    addIssue(issues, issueDetails, "missingViewport", issues.missingViewport, {});
    addIssue(issues, issueDetails, "mixedContent", issues.mixedContent, {
      count: page.technical?.mixedContentResources?.length || 0,
      sample: (page.technical?.mixedContentResources || []).slice(0, 5),
    });
    addIssue(issues, issueDetails, "multipleH1", issues.multipleH1, {
      count: page.headingStats?.h1Count || 0,
    });
    addIssue(issues, issueDetails, "nofollowDirective", issues.nofollowDirective, {});
    addIssue(issues, issueDetails, "noindexDirective", issues.noindexDirective, {});
    addIssue(issues, issueDetails, "orphanPage", issues.orphanPage, {
      incomingInternalLinkCount,
    });
    addIssue(issues, issueDetails, "redirectChain", issues.redirectChain, {
      hops: Math.max(redirects.length - 1, 0),
    });
    addIssue(issues, issueDetails, "redirected", issues.redirected, {
      hops: Math.max(redirects.length - 1, 0),
    });
    addIssue(issues, issueDetails, "slowResponse", issues.slowResponse, {
      responseTimeMs: page.responseTimeMs || 0,
    });
    addIssue(issues, issueDetails, "thinContent", issues.thinContent, {
      wordCount: page.wordCount || 0,
    });
    addIssue(issues, issueDetails, "titleTooLong", issues.titleTooLong, {
      length: page.titleLength || 0,
    });
    addIssue(issues, issueDetails, "titleTooShort", issues.titleTooShort, {
      length: page.titleLength || 0,
    });

    return {
      ...page,
      canonicalDetails: {
        isCrossDomain: Boolean(canonicalOrigin && siteOrigin && canonicalOrigin !== siteOrigin),
        isInvalid: Boolean(page.canonical && !canonicalResolved),
        isSelfReferencing: Boolean(canonicalResolved && pageResolved && canonicalResolved === pageResolved),
        resolved: canonicalResolved,
      },
      issueDetails,
      issues,
      linkStats: {
        ...(page.linkStats || {}),
        brokenCount: page.brokenLinks?.length || 0,
        externalCount: page.externalLinks?.length || 0,
        incomingInternalLinkCount,
        outgoingInternalLinkCount: page.internalLinks?.length || 0,
      },
    };
  });

  return {
    duplicateDescriptions: [...descriptionMap.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([value, urls]) => ({ urls, value })),
    duplicateTitles: [...titleMap.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([value, urls]) => ({ urls, value })),
    pages: enhancedPages,
  };
}

module.exports = {
  analyzeAdvancedChecks,
};
