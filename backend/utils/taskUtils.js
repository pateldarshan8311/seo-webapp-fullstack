const crypto = require("crypto");

const ISSUE_DEFINITIONS = {
  brokenLinks: {
    category: "Links",
    severity: "critical",
    title: "Resolve broken links",
    description: (page, detail) => `${detail.count || 0} broken links were found on ${page.url}.`,
  },
  canonicalMismatch: {
    category: "Meta",
    severity: "medium",
    title: "Align canonical URL",
    description: (page, detail) => `Canonical resolves to ${detail.canonical || "another URL"} instead of the crawled page.`,
  },
  crossDomainCanonical: {
    category: "Meta",
    severity: "high",
    title: "Review cross-domain canonical",
    description: (page, detail) => `Canonical points to ${detail.canonical || "another domain"}, which may dilute indexing signals.`,
  },
  deepPage: {
    category: "Internal Linking",
    severity: "low",
    title: "Reduce crawl depth",
    description: (page, detail) => `Page is ${detail.depth} levels deep from the seed URL and may be harder to discover.`,
  },
  descriptionTooLong: {
    category: "Meta",
    severity: "low",
    title: "Shorten meta description",
    description: (page, detail) => `Meta description length is ${detail.length} characters.`,
  },
  descriptionTooShort: {
    category: "Meta",
    severity: "low",
    title: "Expand meta description",
    description: (page, detail) => `Meta description length is only ${detail.length} characters.`,
  },
  duplicateDescription: {
    category: "Meta",
    severity: "medium",
    title: "Make meta description unique",
    description: (page, detail) => `This description is duplicated across ${detail.duplicateCount} pages.`,
  },
  duplicateTitle: {
    category: "Meta",
    severity: "medium",
    title: "Make page title unique",
    description: (page, detail) => `This title is duplicated across ${detail.duplicateCount} pages.`,
  },
  invalidCanonical: {
    category: "Meta",
    severity: "high",
    title: "Fix invalid canonical",
    description: (page, detail) => `Canonical value "${detail.canonical}" could not be normalized into a valid URL.`,
  },
  invalidStructuredData: {
    category: "Structured Data",
    severity: "high",
    title: "Repair invalid structured data",
    description: (page, detail) => `${detail.invalidItems} JSON-LD blocks failed to parse.`,
  },
  missingAlt: {
    category: "Images",
    severity: "low",
    title: "Add missing image alt text",
    description: (page, detail) => `${detail.count || 0} images are missing alt text on this page.`,
  },
  missingCanonical: {
    category: "Meta",
    severity: "medium",
    title: "Add canonical tag",
    description: (page) => `Page ${page.url} is missing a canonical tag.`,
  },
  missingDescription: {
    category: "Meta",
    severity: "high",
    title: "Add meta description",
    description: (page) => `Page ${page.url} is missing a meta description.`,
  },
  missingH1: {
    category: "Content",
    severity: "medium",
    title: "Add an H1 heading",
    description: (page) => `Page ${page.url} has no H1 heading.`,
  },
  missingKeywords: {
    category: "Meta",
    severity: "low",
    title: "Review meta keywords",
    description: () => `Meta keywords are missing. This is optional for modern SEO but may matter for legacy workflows.`,
  },
  missingLang: {
    category: "Technical",
    severity: "low",
    title: "Set html lang attribute",
    description: (page) => `The HTML lang attribute is missing on ${page.url}.`,
  },
  missingOpenGraph: {
    category: "Social",
    severity: "low",
    title: "Add Open Graph coverage",
    description: (page, detail) => `Missing Open Graph fields: ${detail.missingFields.join(", ")}.`,
  },
  missingStructuredData: {
    category: "Structured Data",
    severity: "low",
    title: "Add structured data",
    description: (page) => `No JSON-LD structured data was detected on ${page.url}.`,
  },
  missingTitle: {
    category: "Meta",
    severity: "high",
    title: "Add page title",
    description: (page) => `Page ${page.url} is missing a meta title.`,
  },
  missingTwitterCard: {
    category: "Social",
    severity: "low",
    title: "Add Twitter card tags",
    description: () => `Twitter card metadata is missing.`,
  },
  missingViewport: {
    category: "Technical",
    severity: "low",
    title: "Add viewport meta tag",
    description: (page) => `Viewport meta tag is missing on ${page.url}.`,
  },
  mixedContent: {
    category: "Technical",
    severity: "high",
    title: "Remove mixed content",
    description: (page, detail) => `${detail.count} insecure resources were loaded on an HTTPS page.`,
  },
  multipleH1: {
    category: "Content",
    severity: "low",
    title: "Consolidate multiple H1 headings",
    description: (page, detail) => `${page.url} contains ${detail.count} H1 headings.`,
  },
  nofollowDirective: {
    category: "Indexing",
    severity: "low",
    title: "Review nofollow directive",
    description: () => `A nofollow directive is present and may limit link equity flow.`,
  },
  noindexDirective: {
    category: "Indexing",
    severity: "medium",
    title: "Review noindex directive",
    description: () => `A noindex directive is present. Confirm that this page should stay out of search results.`,
  },
  orphanPage: {
    category: "Internal Linking",
    severity: "medium",
    title: "Link to orphan page",
    description: (page) => `No incoming internal links were found for ${page.url}.`,
  },
  redirectChain: {
    category: "Technical",
    severity: "high",
    title: "Simplify redirect chain",
    description: (page, detail) => `This page required ${detail.hops} redirect hops before reaching the final URL.`,
  },
  redirected: {
    category: "Technical",
    severity: "low",
    title: "Review redirected URL",
    description: (page, detail) => `The requested URL redirects ${detail.hops} time(s) before landing on ${page.finalUrl}.`,
  },
  slowResponse: {
    category: "Performance",
    severity: "medium",
    title: "Improve response time",
    description: (page, detail) => `Full fetch time was ${detail.responseTimeMs} ms.`,
  },
  thinContent: {
    category: "Content",
    severity: "medium",
    title: "Expand thin content",
    description: (page, detail) => `Only ${detail.wordCount} words were detected on ${page.url}.`,
  },
  titleTooLong: {
    category: "Meta",
    severity: "low",
    title: "Shorten page title",
    description: (page, detail) => `Title length is ${detail.length} characters.`,
  },
  titleTooShort: {
    category: "Meta",
    severity: "low",
    title: "Expand page title",
    description: (page, detail) => `Title length is only ${detail.length} characters.`,
  },
};

const TASK_STATUSES = ["open", "in_progress", "fixed", "ignored"];
const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function getTaskKey(task = {}) {
  return `${task.issueType || ""}::${task.pageUrl || ""}`;
}

function buildTaskSummary(tasks = []) {
  const summary = {
    byCategory: {},
    bySeverity: {},
    byStatus: {},
    total: tasks.length,
  };

  for (const task of tasks) {
    summary.byCategory[task.category] = (summary.byCategory[task.category] || 0) + 1;
    summary.bySeverity[task.severity] = (summary.bySeverity[task.severity] || 0) + 1;
    summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1;
  }

  return summary;
}

function createTaskFromIssue({ auditId, detail, issueType, page, timestamp }) {
  const definition = ISSUE_DEFINITIONS[issueType];

  if (!definition) {
    return null;
  }

  return {
    assignee: "",
    auditId,
    category: definition.category,
    createdAt: timestamp,
    description: definition.description(page, detail || {}),
    detectedAt: timestamp,
    dueDate: "",
    id: crypto.randomUUID(),
    issueType,
    notes: "",
    pageTitle: page.title || "",
    pageUrl: page.url,
    severity: definition.severity,
    status: "open",
    title: definition.title,
    updatedAt: timestamp,
  };
}

function createTasksFromPages({ auditId, pages = [] }) {
  const timestamp = new Date().toISOString();
  const tasks = [];

  for (const page of pages) {
    const issueDetails = page.issueDetails || {};

    for (const [issueType, detail] of Object.entries(issueDetails)) {
      const task = createTaskFromIssue({
        auditId,
        detail,
        issueType,
        page,
        timestamp,
      });

      if (task) {
        tasks.push(task);
      }
    }
  }

  tasks.sort((left, right) => {
    const severityDelta = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.title.localeCompare(right.title);
  });

  return {
    taskSummary: buildTaskSummary(tasks),
    tasks,
  };
}

function filterTasks(tasks = [], filters = {}) {
  const searchNeedle = String(filters.search || "").trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.status && filters.status !== "all" && task.status !== filters.status) {
      return false;
    }

    if (filters.category && filters.category !== "all" && task.category !== filters.category) {
      return false;
    }

    if (filters.severity && filters.severity !== "all" && task.severity !== filters.severity) {
      return false;
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate);

      if (new Date(task.updatedAt) < start) {
        return false;
      }
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);

      if (new Date(task.updatedAt) > end) {
        return false;
      }
    }

    if (!searchNeedle) {
      return true;
    }

    const haystack = [task.title, task.description, task.pageUrl, task.category, task.status, task.severity]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchNeedle);
  });
}

function sanitizeTaskUpdate(payload = {}) {
  const update = {};

  if (typeof payload.status === "string" && TASK_STATUSES.includes(payload.status)) {
    update.status = payload.status;
  }

  if (typeof payload.assignee === "string") {
    update.assignee = payload.assignee.trim();
  }

  if (typeof payload.notes === "string") {
    update.notes = payload.notes.trim();
  }

  if (typeof payload.dueDate === "string") {
    update.dueDate = payload.dueDate.trim();
  }

  return update;
}

function mergeGeneratedTasks(previousTasks = [], generatedTasks = []) {
  const timestamp = new Date().toISOString();
  const previousByKey = new Map(previousTasks.map((task) => [getTaskKey(task), task]));
  const generatedKeys = new Set(generatedTasks.map((task) => getTaskKey(task)));
  const merged = generatedTasks.map((generatedTask) => {
    const existingTask = previousByKey.get(getTaskKey(generatedTask));

    if (!existingTask) {
      return {
        ...generatedTask,
        lastVerifiedAt: timestamp,
        resolvedAt: "",
      };
    }

    const nextStatus =
      existingTask.status === "ignored"
        ? "ignored"
        : existingTask.status === "in_progress"
          ? "in_progress"
          : "open";

    return {
      ...generatedTask,
      assignee: existingTask.assignee || "",
      createdAt: existingTask.createdAt || generatedTask.createdAt,
      detectedAt: existingTask.detectedAt || existingTask.createdAt || generatedTask.createdAt,
      dueDate: existingTask.dueDate || "",
      id: existingTask.id,
      lastVerifiedAt: timestamp,
      notes: existingTask.notes || "",
      resolvedAt: "",
      status: nextStatus,
      updatedAt: timestamp,
    };
  });

  for (const previousTask of previousTasks) {
    const taskKey = getTaskKey(previousTask);

    if (generatedKeys.has(taskKey)) {
      continue;
    }

    merged.push({
      ...previousTask,
      lastVerifiedAt: timestamp,
      resolvedAt: previousTask.resolvedAt || timestamp,
      status: "fixed",
      updatedAt: timestamp,
    });
  }

  merged.sort((left, right) => {
    const severityDelta = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
  });

  return {
    taskSummary: buildTaskSummary(merged),
    tasks: merged,
  };
}

module.exports = {
  ISSUE_DEFINITIONS,
  TASK_STATUSES,
  buildTaskSummary,
  createTasksFromPages,
  filterTasks,
  getTaskKey,
  mergeGeneratedTasks,
  sanitizeTaskUpdate,
};
