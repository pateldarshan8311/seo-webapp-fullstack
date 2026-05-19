export const TAB_OPTIONS = [
  { key: 'all', label: 'All Pages' },
  { key: 'meta', label: 'Meta Issues' },
  { key: 'content', label: 'Content' },
  { key: 'technical', label: 'Technical' },
  { key: 'alt', label: 'Alt Tags' },
  { key: 'broken', label: 'Broken Links' },
  { key: 'external', label: 'External Links' },
  { key: 'tasks', label: 'Tasks' },
];

export const PAGE_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'critical', label: 'Critical pages' },
  { value: 'warning', label: 'Needs attention' },
  { value: 'healthy', label: 'Healthy pages' },
  { value: 'issues', label: 'Pages with issues' },
  { value: 'errors', label: 'HTTP/link errors' },
];

export const PAGE_REVIEW_STATUS_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Needs Attention' },
  { value: 'healthy', label: 'Healthy' },
];

export const TASK_STATUS_OPTIONS = [
  { value: 'all', label: 'All task statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'ignored', label: 'Ignored' },
];

export const TASK_DATE_OPTIONS = [
  { value: 'all', label: 'Any date' },
  { value: 'today', label: 'Updated today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export const PAGE_VIEW_MODES = [
  { value: 'board', label: 'Board' },
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
];

export const TASK_VIEW_MODES = [
  { value: 'board', label: 'Board' },
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
];

export const ISSUE_LABELS = {
  brokenLinks: 'Broken links',
  canonicalMismatch: 'Canonical mismatch',
  crossDomainCanonical: 'Cross-domain canonical',
  deepPage: 'Deep page',
  descriptionTooLong: 'Description too long',
  descriptionTooShort: 'Description too short',
  duplicateDescription: 'Duplicate description',
  duplicateTitle: 'Duplicate title',
  invalidCanonical: 'Invalid canonical',
  invalidStructuredData: 'Invalid structured data',
  missingAlt: 'Missing alt text',
  missingCanonical: 'Missing canonical',
  missingDescription: 'Missing description',
  missingH1: 'Missing H1',
  missingKeywords: 'Missing keywords',
  missingLang: 'Missing lang',
  missingOpenGraph: 'Missing Open Graph',
  missingStructuredData: 'Missing structured data',
  missingTitle: 'Missing title',
  missingTwitterCard: 'Missing Twitter card',
  missingViewport: 'Missing viewport',
  mixedContent: 'Mixed content',
  multipleH1: 'Multiple H1',
  nofollowDirective: 'Nofollow directive',
  noindexDirective: 'Noindex directive',
  orphanPage: 'Orphan page',
  redirectChain: 'Redirect chain',
  redirected: 'Redirected URL',
  slowResponse: 'Slow response',
  thinContent: 'Thin content',
  titleTooLong: 'Title too long',
  titleTooShort: 'Title too short',
};

const SEVERITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

export function formatDuration(durationMs) {
  if (!durationMs) {
    return 'In progress';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatDateTime(value) {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleString();
}

export function formatShortDate(value) {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function humanizeIssueKey(issueKey) {
  return ISSUE_LABELS[issueKey] || issueKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

export function getViewModesForTab(activeTab) {
  return activeTab === 'tasks' ? TASK_VIEW_MODES : PAGE_VIEW_MODES;
}

export function getIssueCount(item) {
  return Object.keys(item?.issueDetails || {}).length;
}

export function getDerivedPageHealthBucket(page) {
  const issueCount = getIssueCount(page);

  if ((page.status || 0) >= 400 || page.issues?.brokenLinks || issueCount >= 5) {
    return 'critical';
  }

  if (issueCount > 0) {
    return 'warning';
  }

  return 'healthy';
}

export function getPageHealthBucket(page) {
  return page?.reviewStatus || getDerivedPageHealthBucket(page);
}

export function getPageHealthLabel(page) {
  const bucket = getPageHealthBucket(page);

  if (bucket === 'critical') {
    return 'Critical';
  }

  if (bucket === 'warning') {
    return 'Needs attention';
  }

  return 'Healthy';
}

export function getPageBoardColumns(pages = []) {
  const columns = [
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Needs Attention' },
    { key: 'healthy', label: 'Healthy' },
  ];

  return columns.map((column) => ({
    ...column,
    items: pages.filter((page) => getPageHealthBucket(page) === column.key),
  }));
}

export function getTaskBoardColumns(tasks = []) {
  const columns = [
    { key: 'open', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'fixed', label: 'Done' },
    { key: 'ignored', label: 'Ignored' },
  ];

  return columns.map((column) => ({
    ...column,
    items: tasks.filter((task) => task.status === column.key),
  }));
}

export function buildDashboardMetrics(audit) {
  const totals = audit?.summary?.totals || {};
  const pages = audit?.pages || [];
  const taskSummary = audit?.taskSummary || audit?.summary?.taskSummary || {};

  return [
    {
      label: 'Pages Crawled',
      value: totals.totalPages || pages.length,
    },
    {
      label: 'Total Tasks',
      value: taskSummary.total || 0,
    },
    {
      label: 'Open Tasks',
      value: taskSummary.byStatus?.open || 0,
    },
    {
      label: 'Critical Tasks',
      value: taskSummary.bySeverity?.critical || 0,
    },
    {
      label: 'Broken Links',
      value: totals.brokenLinks || 0,
    },
    {
      label: 'Orphan Pages',
      value: totals.orphanPages || 0,
    },
  ];
}

function matchesPageSearch(page, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const needle = searchTerm.toLowerCase();
  const haystack = [
    page.url,
    page.finalUrl,
    page.title,
    page.description,
    page.keywords,
    ...(page.h1 || []),
    ...(page.h2 || []),
    ...Object.keys(page.issueDetails || {}).map(humanizeIssueKey),
    ...(page.structuredData?.types || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

function matchesPageStatusFilter(page, statusFilter) {
  if (statusFilter === 'all') {
    return true;
  }

  if (['critical', 'warning', 'healthy'].includes(statusFilter)) {
    return getPageHealthBucket(page) === statusFilter;
  }

  if (statusFilter === 'errors') {
    return (page.status || 0) >= 400 || page.brokenLinks?.length > 0;
  }

  if (statusFilter === 'issues') {
    return Object.values(page.issues || {}).some(Boolean);
  }

  return (page.status || 0) < 400 && !Object.values(page.issues || {}).some(Boolean);
}

function isMetaIssuePage(page) {
  return (
    page.issues?.missingTitle ||
    page.issues?.missingDescription ||
    page.issues?.duplicateTitle ||
    page.issues?.duplicateDescription ||
    page.issues?.missingCanonical ||
    page.issues?.invalidCanonical ||
    page.issues?.canonicalMismatch ||
    page.issues?.crossDomainCanonical ||
    page.issues?.titleTooLong ||
    page.issues?.titleTooShort ||
    page.issues?.descriptionTooLong ||
    page.issues?.descriptionTooShort
  );
}

function isContentIssuePage(page) {
  return (
    page.issues?.thinContent ||
    page.issues?.missingH1 ||
    page.issues?.multipleH1 ||
    page.issues?.orphanPage ||
    page.issues?.deepPage
  );
}

function isTechnicalIssuePage(page) {
  return (
    page.issues?.missingLang ||
    page.issues?.missingViewport ||
    page.issues?.noindexDirective ||
    page.issues?.nofollowDirective ||
    page.issues?.missingOpenGraph ||
    page.issues?.missingTwitterCard ||
    page.issues?.mixedContent ||
    page.issues?.slowResponse ||
    page.issues?.missingStructuredData ||
    page.issues?.invalidStructuredData ||
    page.issues?.redirectChain ||
    page.issues?.redirected
  );
}

export function filterPagesByView(pages, activeTab, searchTerm, statusFilter) {
  return (pages || []).filter((page) => {
    const tabMatch =
      activeTab === 'all' ||
      (activeTab === 'meta' && isMetaIssuePage(page)) ||
      (activeTab === 'content' && isContentIssuePage(page)) ||
      (activeTab === 'technical' && isTechnicalIssuePage(page)) ||
      (activeTab === 'alt' && page.issues?.missingAlt) ||
      (activeTab === 'broken' && (page.brokenLinks || []).length > 0) ||
      (activeTab === 'external' && (page.externalLinks || []).length > 0);

    return tabMatch && matchesPageSearch(page, searchTerm) && matchesPageStatusFilter(page, statusFilter);
  });
}

export function buildTabCounts(pages = [], tasks = []) {
  return {
    all: pages.length,
    alt: pages.filter((page) => page.issues?.missingAlt).length,
    broken: pages.filter((page) => (page.brokenLinks || []).length > 0).length,
    content: pages.filter((page) => isContentIssuePage(page)).length,
    external: pages.filter((page) => (page.externalLinks || []).length > 0).length,
    meta: pages.filter((page) => isMetaIssuePage(page)).length,
    tasks: tasks.length,
    technical: pages.filter((page) => isTechnicalIssuePage(page)).length,
  };
}

function matchesTaskSearch(task, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const needle = searchTerm.toLowerCase();
  const haystack = [task.title, task.description, task.pageUrl, task.category, task.severity, task.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

function matchesTaskDateFilter(task, dateFilter) {
  if (dateFilter === 'all') {
    return true;
  }

  const taskTime = new Date(task.updatedAt || task.createdAt).getTime();
  const now = Date.now();

  if (dateFilter === 'today') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return taskTime >= startOfToday.getTime();
  }

  if (dateFilter === '7d') {
    return taskTime >= now - 7 * 24 * 60 * 60 * 1000;
  }

  if (dateFilter === '30d') {
    return taskTime >= now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

export function filterTasksByView(tasks, searchTerm, statusFilter, categoryFilter, dateFilter) {
  return [...(tasks || [])]
    .filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && task.category !== categoryFilter) {
        return false;
      }

      return matchesTaskSearch(task, searchTerm) && matchesTaskDateFilter(task, dateFilter);
    })
    .sort((left, right) => {
      const severityDelta = (SEVERITY_RANK[left.severity] ?? 99) - (SEVERITY_RANK[right.severity] ?? 99);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

export function serializePagesToCsv(pages) {
  const headers = [
    'URL',
    'Status',
    'Title',
    'Description',
    'Keywords',
    'H1',
    'H2',
    'Canonical',
    'Word Count',
    'Response Time (ms)',
    'Crawl Depth',
    'Broken Link Count',
    'External Link Count',
    'Issue Count',
  ];

  const escapeValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const rows = pages.map((page) =>
    [
      page.url,
      page.status,
      page.title,
      page.description,
      page.keywords,
      (page.h1 || []).join(' | '),
      (page.h2 || []).join(' | '),
      page.canonical,
      page.wordCount,
      page.responseTimeMs,
      page.crawlDepth,
      page.brokenLinks?.length || 0,
      page.externalLinks?.length || 0,
      Object.keys(page.issueDetails || {}).length,
    ]
      .map(escapeValue)
      .join(','),
  );

  return [headers.map(escapeValue).join(','), ...rows].join('\n');
}

export function serializeTasksToCsv(tasks) {
  const headers = ['Task', 'Category', 'Severity', 'Status', 'Page URL', 'Created At', 'Updated At', 'Due Date', 'Assignee', 'Notes'];
  const escapeValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

  const rows = tasks.map((task) =>
    [
      task.title,
      task.category,
      task.severity,
      task.status,
      task.pageUrl,
      task.createdAt,
      task.updatedAt,
      task.dueDate,
      task.assignee,
      task.notes,
    ]
      .map(escapeValue)
      .join(','),
  );

  return [headers.map(escapeValue).join(','), ...rows].join('\n');
}

export function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
