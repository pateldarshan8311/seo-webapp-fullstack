const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const axios = require("axios");
const cheerio = require("cheerio");

const { closeSession, createSession, renderPageWithSession } = require("../auth/loginHandler");
const { collectAutoSeedUrls, discoverInternalUrls } = require("./autoCrawler");
const { collectManualUrls } = require("./manualCrawler");
const { collectSitemapUrls } = require("./sitemapCrawler");
const { analyzeImages } = require("../seo/altTagAnalyzer");
const { analyzeAdvancedChecks } = require("../seo/advancedChecks");
const { analyzeContent } = require("../seo/contentAnalyzer");
const { analyzeHeadings } = require("../seo/headingAnalyzer");
const { analyzeLinks } = require("../seo/linkAnalyzer");
const { analyzeMeta } = require("../seo/metaAnalyzer");
const { analyzeStructuredData } = require("../seo/structuredDataAnalyzer");
const { analyzeTechnical } = require("../seo/technicalAnalyzer");
const AsyncQueue = require("../utils/queue");
const {
  buildTaskSummary,
  createTasksFromPages,
  filterTasks,
  getTaskKey,
  mergeGeneratedTasks,
  sanitizeTaskUpdate,
} = require("../utils/taskUtils");
const { sanitizePageUpdate } = require("../utils/pageUtils");
const {
  isHtmlResponse,
  isSameOrigin,
  normalizeUrl,
  resolveUrl,
  shouldSkipUrl,
} = require("../utils/urlUtils");

const DATA_DIR = path.join(__dirname, "..", "data", "audits");
const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

class AuditService {
  constructor(auditRepository) {
    this.jobs = new Map();
    this.auditRepository = auditRepository;
  }

  async createAudit(payload = {}) {
    const config = this.normalizeConfig(payload);
    const auditId = crypto.randomUUID();
    const audit = this.hydrateAudit({
      id: auditId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "queued",
      error: null,
      config,
      progress: {
        crawled: 0,
        currentUrl: null,
        discovered: 0,
        percent: 0,
        remaining: 0,
        startedAt: null,
      },
      storagePath: path.join(DATA_DIR, `${auditId}.json`),
    });

    this.jobs.set(auditId, audit);
    await this.persistAudit(audit);

    this.runAudit(audit).catch(async (error) => {
      audit.status = "failed";
      audit.error = error.message || "Audit failed";
      audit.updatedAt = new Date().toISOString();
      await this.persistAudit(audit);
    });

    return this.serializeAudit(audit, { includePages: false, includeTasks: false });
  }

  async getAudit(auditId) {
    const inMemoryAudit = this.jobs.get(auditId);

    if (inMemoryAudit) {
      return this.serializeAudit(inMemoryAudit);
    }

    try {
      const storedAudit = await this.auditRepository.findById(auditId);

      if (!storedAudit) {
        return null;
      }

      return this.serializeAudit(storedAudit);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async listAudits() {
    const audits = (await this.auditRepository.listAll()).map((audit) => this.hydrateAudit(audit));

    return audits
      .filter(Boolean)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((audit) => this.serializeAudit(audit, { includePages: false, includeTasks: false }));
  }

  async getTasks(auditId, filters = {}) {
    const audit = await this.loadAuditRecord(auditId);

    if (!audit) {
      return null;
    }

    const tasks = filterTasks(audit.tasks || [], filters);

    return {
      categories: Object.keys(audit.taskSummary?.byCategory || {}),
      filters,
      summary: buildTaskSummary(tasks),
      tasks,
    };
  }

  async updateTask(auditId, taskId, payload = {}) {
    const audit = await this.loadAuditRecord(auditId);

    if (!audit) {
      return null;
    }

    const update = sanitizeTaskUpdate(payload);
    const taskIndex = (audit.tasks || []).findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return null;
    }

    const currentTask = audit.tasks[taskIndex];
    const nextTask = {
      ...currentTask,
      ...update,
      updatedAt: new Date().toISOString(),
    };

    audit.tasks[taskIndex] = nextTask;
    audit.taskSummary = buildTaskSummary(audit.tasks);
    audit.updatedAt = new Date().toISOString();
    await this.persistAudit(audit);

    return {
      task: nextTask,
      taskSummary: audit.taskSummary,
      updatedAt: audit.updatedAt,
    };
  }

  async updatePage(auditId, pageUrl, payload = {}) {
    const audit = await this.loadAuditRecord(auditId);

    if (!audit) {
      return null;
    }

    const update = sanitizePageUpdate(payload);
    const pageIndex = this.findPageIndex(audit, pageUrl);

    if (pageIndex < 0 || !Object.keys(update).length) {
      return null;
    }

    const currentPage = audit.pages[pageIndex];
    const nextPage = {
      ...currentPage,
      ...update,
      reviewStatusUpdatedAt: new Date().toISOString(),
    };

    audit.pages[pageIndex] = nextPage;
    audit.updatedAt = new Date().toISOString();
    await this.persistAudit(audit);

    return {
      audit: this.serializeAudit(audit),
      page: nextPage,
      updatedAt: audit.updatedAt,
    };
  }

  async verifyTask(auditId, taskId) {
    const audit = await this.loadAuditRecord(auditId);

    if (!audit) {
      return null;
    }

    if (audit.runtime?.pageQueue) {
      throw new Error("Wait for the current crawl to finish before verifying tasks.");
    }

    const targetTask = (audit.tasks || []).find((task) => task.id === taskId);

    if (!targetTask) {
      return null;
    }

    const result = await this.recheckPages(audit, [targetTask.pageUrl]);
    const updatedTask = result.tasks.find((task) => task.id === taskId) || null;

    return {
      audit: this.serializeAudit(audit),
      recheckedPages: [targetTask.pageUrl],
      task: updatedTask,
      taskSummary: audit.taskSummary,
      updatedAt: audit.updatedAt,
      verified: Boolean(updatedTask && updatedTask.status === "fixed"),
    };
  }

  async verifyOpenTasks(auditId) {
    const audit = await this.loadAuditRecord(auditId);

    if (!audit) {
      return null;
    }

    if (audit.runtime?.pageQueue) {
      throw new Error("Wait for the current crawl to finish before verifying tasks.");
    }

    const recheckUrls = [
      ...new Set(
        (audit.tasks || [])
          .filter((task) => ["open", "in_progress"].includes(task.status))
          .map((task) => task.pageUrl)
          .filter(Boolean),
      ),
    ];

    const result = await this.recheckPages(audit, recheckUrls);

    return {
      audit: this.serializeAudit(audit),
      recheckedPages: recheckUrls,
      taskSummary: audit.taskSummary,
      updatedAt: audit.updatedAt,
      verifiedCount: result.fixedTaskCount,
    };
  }

  async pauseAudit(auditId) {
    const audit = this.jobs.get(auditId);

    if (!audit?.runtime?.pageQueue) {
      throw new Error("Audit is not running");
    }

    audit.runtime.pageQueue.pause();
    audit.runtime.linkQueue.pause();
    audit.status = "paused";
    audit.updatedAt = new Date().toISOString();
    await this.persistAudit(audit);
    return this.serializeAudit(audit, { includePages: false, includeTasks: false });
  }

  async resumeAudit(auditId) {
    const audit = this.jobs.get(auditId);

    if (!audit?.runtime?.pageQueue) {
      throw new Error("Audit is not running");
    }

    audit.runtime.pageQueue.resume();
    audit.runtime.linkQueue.resume();
    audit.status = "running";
    audit.updatedAt = new Date().toISOString();
    await this.persistAudit(audit);
    return this.serializeAudit(audit, { includePages: false, includeTasks: false });
  }

  hydrateAudit(audit = {}) {
    const auditId = audit.id || crypto.randomUUID();

    return {
      config: audit.config || {},
      createdAt: audit.createdAt || new Date().toISOString(),
      error: audit.error || null,
      id: auditId,
      pages: audit.pages || [],
      progress: {
        crawled: 0,
        currentUrl: null,
        discovered: 0,
        percent: 0,
        remaining: 0,
        startedAt: null,
        ...(audit.progress || {}),
      },
      runtime: audit.runtime || null,
      status: audit.status || "queued",
      storagePath: audit.storagePath || path.join(DATA_DIR, `${auditId}.json`),
      summary: audit.summary || {},
      taskSummary: audit.taskSummary || buildTaskSummary(audit.tasks || []),
      tasks: audit.tasks || [],
      updatedAt: audit.updatedAt || new Date().toISOString(),
    };
  }

  normalizeConfig(payload) {
    const mode = ["sitemap", "auto", "manual"].includes(payload.mode) ? payload.mode : "auto";
    const normalizeCrawlUrl = (value, baseUrl) => {
      const normalized = value ? normalizeUrl(value, baseUrl) : null;
      return normalized ? this.getPreferredRenderUrl(normalized) : null;
    };
    const targetUrl = normalizeCrawlUrl(payload.targetUrl);
    const manualUrls = Array.isArray(payload.manualUrls)
      ? payload.manualUrls.map((url) => normalizeCrawlUrl(url, targetUrl || undefined)).filter(Boolean)
      : [];

    if (!targetUrl && mode !== "manual") {
      throw new Error("A valid target URL is required.");
    }

    if (mode === "manual" && manualUrls.length === 0) {
      throw new Error("Manual crawl mode requires at least one URL.");
    }

    return {
      auth: payload.auth || {},
      concurrency: Math.min(Math.max(Number(payload.concurrency) || 4, 1), 12),
      deepScan: payload.deepScan !== false,
      maxRedirects: Math.min(Math.max(Number(payload.maxRedirects) || 5, 1), 10),
      manualUrls,
      mode,
      rateLimitMs: Math.min(Math.max(Number(payload.rateLimitMs) || 250, 0), 5000),
      renderJs: Boolean(payload.renderJs),
      sitemapUrl: normalizeCrawlUrl(payload.sitemapUrl, targetUrl || undefined),
      targetUrl,
      timeoutMs: Math.min(Math.max(Number(payload.timeoutMs) || 20000, 3000), 60000),
      userAgent: payload.userAgent || DEFAULT_BROWSER_USER_AGENT,
    };
  }

  async runAudit(audit) {
    audit.status = "running";
    audit.progress.startedAt = new Date().toISOString();
    audit.updatedAt = new Date().toISOString();

    let session = null;

    try {
      session = await createSession(audit.config.auth, {
        enableBrowser: audit.config.renderJs,
        targetUrl: audit.config.targetUrl || audit.config.manualUrls[0],
        userAgent: audit.config.userAgent,
      });

      const pageQueue = new AsyncQueue({
        concurrency: audit.config.concurrency,
        delayMs: audit.config.rateLimitMs,
      });

      audit.runtime = {
        ...this.createRuntimeState(audit, session, {
          pageQueue,
        }),
      };

      const seedUrls = await this.getSeedUrls(audit);

      if (!seedUrls.length) {
        throw new Error("No crawlable URLs were discovered.");
      }

      for (const url of seedUrls) {
        this.enqueuePage(audit, url, 0);
      }

      await this.persistAudit(audit);
      await pageQueue.onIdle();
      await Promise.allSettled(audit.runtime.pageDetailPromises || []);
      await audit.runtime.linkQueue.onIdle();

      audit.pages = this.syncInternalLinkStatusesFromPages(audit.pages, audit.config.targetUrl);

      const advanced = analyzeAdvancedChecks(audit.pages, audit.config.targetUrl || audit.pages[0]?.url);
      audit.pages = this.mergePageWorkflowState(audit.pages, advanced.pages);

      const { tasks, taskSummary } = createTasksFromPages({
        auditId: audit.id,
        pages: audit.pages,
      });

      audit.tasks = tasks;
      audit.taskSummary = taskSummary;
      audit.summary = this.buildSummary(audit.pages, advanced, taskSummary, audit.progress.startedAt);
      audit.status = "completed";
      audit.progress.currentUrl = null;
      audit.progress.percent = 100;
      audit.progress.remaining = 0;
      audit.updatedAt = new Date().toISOString();
      await this.persistAudit(audit);
    } finally {
      if (session) {
        await closeSession(session).catch(() => null);
      }

      audit.runtime = null;
    }
  }

  createRuntimeState(audit, session, overrides = {}) {
    return {
      depthMap: new Map(),
      linkQueue:
        overrides.linkQueue ||
        new AsyncQueue(this.getLinkQueueOptions(audit)),
      linkStatusCache: new Map(),
      pageQueue: overrides.pageQueue || null,
      queuedUrls: overrides.queuedUrls || new Set(),
      session,
      visitedUrls: overrides.visitedUrls || new Set(),
      pageDetailPromises: overrides.pageDetailPromises || [],
    };
  }

  async recheckPages(audit, pageUrls = []) {
    const uniqueUrls = [...new Set(pageUrls.map((url) => normalizeUrl(url, audit.config.targetUrl || undefined)).filter(Boolean))];

    if (uniqueUrls.length === 0) {
      return {
        fixedTaskCount: 0,
        tasks: audit.tasks || [],
      };
    }

    const previousTasks = [...(audit.tasks || [])];
    let session = null;
    const previousRuntime = audit.runtime;

    try {
      session = await createSession(audit.config.auth, {
        enableBrowser: audit.config.renderJs,
        targetUrl: audit.config.targetUrl || uniqueUrls[0],
        userAgent: audit.config.userAgent,
      });

      audit.runtime = this.createRuntimeState(audit, session);

      const pageByUrl = new Map((audit.pages || []).map((page) => [page.url, page]));
      const pageDetailPromises = [];

      for (const pageUrl of uniqueUrls) {
        const previousPage = pageByUrl.get(pageUrl);
        audit.runtime.depthMap.set(pageUrl, previousPage?.crawlDepth || 0);
        const response = await this.fetchPage(audit, pageUrl);
        const nextPage = await this.buildPageRecord(audit, pageUrl, response, { deferLinkStatusResolution: true });
        pageByUrl.set(pageUrl, nextPage);
        pageDetailPromises.push(
          this.enrichPageLinkData(audit, nextPage)
            .then((enrichedPage) => {
              pageByUrl.set(pageUrl, enrichedPage);
            })
            .catch(() => null),
        );
      }

      await Promise.allSettled(pageDetailPromises);
      await audit.runtime.linkQueue.onIdle();

      const nextPages = this.syncInternalLinkStatusesFromPages(
        (audit.pages || []).map((page) => pageByUrl.get(page.url) || page),
        audit.config.targetUrl,
      );
      const advanced = analyzeAdvancedChecks(nextPages, audit.config.targetUrl || nextPages[0]?.url);
      audit.pages = this.mergePageWorkflowState(audit.pages, advanced.pages);

      const generated = createTasksFromPages({
        auditId: audit.id,
        pages: audit.pages,
      });
      const merged = mergeGeneratedTasks(previousTasks, generated.tasks);

      audit.tasks = merged.tasks;
      audit.taskSummary = merged.taskSummary;
      audit.summary = this.buildSummary(audit.pages, advanced, audit.taskSummary, audit.progress.startedAt);
      audit.updatedAt = new Date().toISOString();
      await this.persistAudit(audit);

      const previousOpenKeys = new Set(
        previousTasks.filter((task) => ["open", "in_progress"].includes(task.status)).map((task) => getTaskKey(task)),
      );
      const nextFixedCount = merged.tasks.filter((task) => task.status === "fixed" && previousOpenKeys.has(getTaskKey(task))).length;

      return {
        fixedTaskCount: nextFixedCount,
        tasks: merged.tasks,
      };
    } finally {
      if (session) {
        await closeSession(session).catch(() => null);
      }

      audit.runtime = previousRuntime || null;
    }
  }

  async getSeedUrls(audit) {
    const { config } = audit;

    if (config.mode === "manual") {
      return collectManualUrls({
        manualUrls: config.manualUrls,
        targetUrl: config.targetUrl || config.manualUrls[0],
      });
    }

    if (config.mode === "sitemap") {
      return collectSitemapUrls({
        fetchText: async (url) => {
          const response = await this.requestUrlText(audit, url, {
            accept: "application/xml,text/xml,text/html;q=0.9",
          });
          return response;
        },
        sitemapUrl: config.sitemapUrl,
        targetUrl: config.targetUrl,
      });
    }

    return collectAutoSeedUrls({ targetUrl: config.targetUrl });
  }

  enqueuePage(audit, url, depth = 0) {
    const normalized = normalizeUrl(url, audit.config.targetUrl || undefined);

    if (!normalized || shouldSkipUrl(normalized)) {
      return false;
    }

    if (audit.config.targetUrl && !isSameOrigin(normalized, audit.config.targetUrl)) {
      return false;
    }

    if (audit.runtime.queuedUrls.has(normalized) || audit.runtime.visitedUrls.has(normalized)) {
      return false;
    }

    audit.runtime.queuedUrls.add(normalized);
    audit.runtime.depthMap.set(normalized, depth);
    this.updateProgress(audit);

    audit.runtime.pageQueue
      .add(async () => {
        await this.processPage(audit, normalized);
      }, { url: normalized })
      .catch(() => null);

    return true;
  }

  async processPage(audit, url) {
    if (audit.runtime.visitedUrls.has(url)) {
      return;
    }

    audit.runtime.visitedUrls.add(url);
    audit.progress.currentUrl = url;
    audit.updatedAt = new Date().toISOString();

    const response = await this.fetchPage(audit, url);
    const pageRecord = await this.buildPageRecord(audit, url, response, { deferLinkStatusResolution: true });
    audit.pages.push(pageRecord);
    audit.progress.crawled += 1;

    if (audit.config.mode === "auto") {
      const discoveredUrls = discoverInternalUrls({
        pageRecord,
        targetUrl: audit.config.targetUrl,
      });
      const nextDepth = (audit.runtime.depthMap.get(url) || 0) + 1;

      for (const discoveredUrl of discoveredUrls) {
        this.enqueuePage(audit, discoveredUrl, nextDepth);
      }
    }

    this.updateProgress(audit);
    await this.persistAudit(audit);

    const pageDetailPromise = this.enrichPageLinkData(audit, pageRecord).catch(() => null);
    audit.runtime.pageDetailPromises.push(pageDetailPromise);
  }

  async fetchPage(audit, url) {
    const redirectChain = [];
    let currentUrl = this.getPreferredRenderUrl(url);
    let html = "";
    let headers = {};
    let finalStatus = 0;
    const startedAt = Date.now();

    for (let attempt = 0; attempt <= audit.config.maxRedirects; attempt += 1) {
      const response = await axios
        .get(currentUrl, {
          headers: this.buildHeaders(audit, {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          }),
          maxRedirects: 0,
          responseType: "text",
          timeout: audit.config.timeoutMs,
          validateStatus: () => true,
        })
        .catch((error) => {
          return {
            data: "",
            headers: {},
            status: error.response?.status || 0,
          };
        });

      headers = response.headers || {};
      finalStatus = response.status || 0;
      redirectChain.push({
        status: finalStatus,
        url: currentUrl,
      });

      const location = headers.location ? resolveUrl(currentUrl, headers.location) : null;

      if (location && finalStatus >= 300 && finalStatus < 400) {
        currentUrl = location;
        continue;
      }

      html = typeof response.data === "string" ? response.data : "";
      break;
    }

    const shouldRenderInBrowser =
      (audit.config.renderJs && finalStatus && finalStatus < 500) ||
      this.shouldBypassInterstitial({ headers, html, status: finalStatus });

    if (shouldRenderInBrowser) {
      const renderUrl = this.getPreferredRenderUrl(currentUrl);
      const rendered = await renderPageWithSession({
        session: audit.runtime.session,
        timeoutMs: audit.config.timeoutMs,
        url: renderUrl,
      }).catch(() => null);

      if (rendered) {
        html = rendered.html;
        headers = rendered.headers || headers;
        finalStatus = rendered.status || finalStatus;
        currentUrl = rendered.finalUrl || currentUrl;
      }
    }

    return {
      finalUrl: currentUrl,
      headers,
      html,
      redirectChain,
      responseTimeMs: Date.now() - startedAt,
      status: finalStatus,
    };
  }

  shouldBypassInterstitial({ headers = {}, html = "", status = 0 }) {
    const normalizedHtml = String(html || "").toLowerCase();
    const serverHeader = String(headers.server || headers.Server || "").toLowerCase();

    const interstitialSignals = [
      "just a moment...",
      "enable javascript and cookies to continue",
      "cf-chl",
      "challenge-platform",
      "attention required!",
      "checking if the site connection is secure",
    ];

    return (
      [403, 429, 503].includes(Number(status) || 0) &&
      interstitialSignals.some((signal) => normalizedHtml.includes(signal))
    ) || (
      serverHeader.includes("cloudflare") &&
      interstitialSignals.some((signal) => normalizedHtml.includes(signal))
    );
  }

  async buildPageRecord(audit, url, response, options = {}) {
    const crawlDepth = audit.runtime?.depthMap?.get(url) || 0;
    const pageRecord = {
      canonical: "",
      contentStats: {
        paragraphCount: 0,
        readingTimeMinutes: 0,
        textExcerpt: "",
      },
      crawlDepth,
      description: "",
      descriptionLength: 0,
      externalLinks: [],
      finalUrl: response.finalUrl || url,
      h1: [],
      h2: [],
      headingStats: {
        h1Count: 0,
        h2Count: 0,
      },
      http: {
        contentType: String(response.headers?.["content-type"] || ""),
      },
      imageStats: {
        missingAltCount: 0,
        presentAltCount: 0,
        totalImages: 0,
      },
      images: [],
      internalLinks: [],
      issueDetails: {},
      issues: {
        duplicateDescription: false,
        duplicateTitle: false,
        missingAlt: false,
        missingDescription: false,
        missingTitle: false,
      },
      keywords: "",
      linkStats: {
        brokenCount: 0,
        externalCount: 0,
        incomingInternalLinkCount: 0,
        outgoingInternalLinkCount: 0,
      },
      openGraph: {},
      redirectChain: response.redirectChain,
      responseTimeMs: response.responseTimeMs || 0,
      reviewStatus: "",
      reviewStatusUpdatedAt: null,
      status: response.status,
      structuredData: {
        invalidItems: 0,
        items: [],
        totalItems: 0,
        types: [],
        validItems: 0,
      },
      technical: {
        directives: [],
        hasNofollow: false,
        hasNoindex: false,
        hreflang: [],
        htmlLang: "",
        mixedContentResources: [],
        robotsMeta: "",
        twitter: {},
        viewport: "",
        xRobotsTag: "",
      },
      thirdPartyUrls: [],
      title: "",
      titleLength: 0,
      url,
      wordCount: 0,
      brokenLinks: [],
    };

    if (!response.html || !isHtmlResponse(response.headers)) {
      pageRecord.issues.missingTitle = true;
      pageRecord.issues.missingDescription = true;
      return pageRecord;
    }

    const $ = cheerio.load(response.html);
    const meta = analyzeMeta($);
    const headings = analyzeHeadings($);
    const content = analyzeContent($);
    const technical = audit.config.deepScan ? analyzeTechnical($, pageRecord.finalUrl, response.headers) : { technical: pageRecord.technical };
    const structuredData = audit.config.deepScan ? analyzeStructuredData($) : { structuredData: pageRecord.structuredData };
    const { imageStats, images } = analyzeImages($, pageRecord.finalUrl);
    const links = analyzeLinks($, pageRecord.finalUrl, audit.config.targetUrl || pageRecord.finalUrl);
    const internalLinks = options.deferLinkStatusResolution
      ? links.internalLinks.map((link) => ({
          ...link,
          status: null,
        }))
      : [];
    const externalLinks = options.deferLinkStatusResolution
      ? links.externalLinks.map((link) => ({
          ...link,
          status: null,
        }))
      : [];
    const brokenLinks = [];

    const nextPageRecord = {
      ...pageRecord,
      ...content,
      ...headings,
      ...meta,
      ...structuredData,
      ...technical,
      brokenLinks,
      descriptionLength: meta.description.length,
      externalLinks,
      headingStats: {
        h1Count: headings.h1.length,
        h2Count: headings.h2.length,
      },
      imageStats,
      images,
      internalLinks,
      issues: {
        ...pageRecord.issues,
        missingAlt: imageStats.missingAltCount > 0,
        missingDescription: !meta.description,
        missingTitle: !meta.title,
      },
      linkStats: {
        brokenCount: 0,
        externalCount: links.externalLinks.length,
        incomingInternalLinkCount: 0,
        outgoingInternalLinkCount: links.internalLinks.length,
      },
      thirdPartyUrls: links.thirdPartyUrls,
      titleLength: meta.title.length,
      wordCount: content.contentStats.wordCount,
    };

    if (!options.deferLinkStatusResolution) {
      return this.enrichPageLinkData(audit, nextPageRecord);
    }

    return {
      ...nextPageRecord,
      pendingLinkChecks: links,
    };
  }

  async enrichPageLinkData(audit, pageRecord) {
    const pendingLinks = pageRecord.pendingLinkChecks || {
      externalLinks: pageRecord.externalLinks || [],
      internalLinks: pageRecord.internalLinks || [],
      thirdPartyUrls: pageRecord.thirdPartyUrls || [],
    };
    const linksToResolve = [
      ...(this.shouldResolveInternalLinkStatuses(audit) ? pendingLinks.internalLinks : []),
      ...(this.shouldResolveExternalLinkStatuses(audit) ? pendingLinks.externalLinks : []),
    ];
    const linkStatuses = await this.resolveLinkStatuses(audit, linksToResolve);

    const internalLinks = pendingLinks.internalLinks.map((link) => ({
      ...link,
      status: linkStatuses[link.url] ?? link.status ?? null,
    }));
    const externalLinks = pendingLinks.externalLinks.map((link) => ({
      ...link,
      status: linkStatuses[link.url] ?? link.status ?? null,
    }));
    const brokenLinks = [
      ...internalLinks.filter((link) => this.isBrokenLinkStatus(link.status, { linkUrl: link.url })),
      ...externalLinks.filter((link) =>
        this.isBrokenLinkStatus(link.status, {
          isExternal: true,
          linkUrl: link.url,
        })),
    ];

    const nextPageRecord = {
      ...pageRecord,
      brokenLinks,
      externalLinks,
      internalLinks,
      linkStats: {
        ...(pageRecord.linkStats || {}),
        brokenCount: brokenLinks.length,
        externalCount: externalLinks.length,
        outgoingInternalLinkCount: internalLinks.length,
      },
      pendingLinkChecks: undefined,
      thirdPartyUrls: pendingLinks.thirdPartyUrls || [],
    };

    const pageIndex = this.findPageIndex(audit, pageRecord.url);

    if (pageIndex >= 0) {
      audit.pages[pageIndex] = nextPageRecord;
      await this.persistAudit(audit);
    }

    return nextPageRecord;
  }

  async resolveLinkStatuses(audit, links) {
    const entries = await Promise.all(
      links.map(async (link) => {
        const status = await this.getLinkStatus(audit, link.url);
        return [link.url, status];
      }),
    );

    return Object.fromEntries(entries);
  }

  async getLinkStatus(audit, linkUrl) {
    if (audit.runtime.linkStatusCache.has(linkUrl)) {
      return audit.runtime.linkStatusCache.get(linkUrl);
    }

    const statusPromise = audit.runtime.linkQueue
      .add(async () => {
        const timeoutMs = this.getLinkStatusTimeoutMs(audit);
        const headResponse = await axios
          .head(linkUrl, {
            headers: this.buildHeaders(audit, { Accept: "*/*" }),
            maxRedirects: audit.config.maxRedirects,
            timeout: timeoutMs,
            validateStatus: () => true,
          })
          .catch(() => null);

        if (headResponse && !this.shouldRetryLinkWithGet(headResponse.status)) {
          return headResponse.status || 0;
        }

        const getResponse = await axios
          .get(linkUrl, {
            headers: this.buildHeaders(audit, { Accept: "*/*" }),
            maxRedirects: audit.config.maxRedirects,
            timeout: timeoutMs,
            responseType: "stream",
            validateStatus: () => true,
          })
          .catch(() => null);

        return getResponse?.status || headResponse?.status || 0;
      }, { url: linkUrl })
      .catch(() => 0);

    audit.runtime.linkStatusCache.set(linkUrl, statusPromise);
    return statusPromise;
  }

  getLinkStatusTimeoutMs(audit) {
    return Math.min(8000, Math.max(3000, Math.floor((audit.config.timeoutMs || 20000) / 3)));
  }

  shouldResolveInternalLinkStatuses(audit) {
    return audit.config.mode === "manual";
  }

  shouldResolveExternalLinkStatuses(_audit) {
    return false;
  }

  shouldRetryLinkWithGet(status) {
    if (!status) {
      return true;
    }

    return status === 405 || status >= 400;
  }

  isBrokenLinkStatus(status, options = {}) {
    const numericStatus = Number(status) || 0;

    if (!numericStatus) {
      return false;
    }

    if (options.isExternal && [401, 403, 429].includes(numericStatus)) {
      return false;
    }

    return numericStatus >= 400;
  }

  syncInternalLinkStatusesFromPages(pages = [], targetUrl) {
    const statusByUrl = new Map();

    for (const page of pages) {
      for (const candidate of [page.url, page.finalUrl]) {
        const normalized = normalizeUrl(candidate, targetUrl || undefined);

        if (!normalized) {
          continue;
        }

        statusByUrl.set(normalized, page.status || 0);
      }
    }

    return pages.map((page) => {
      const internalLinks = (page.internalLinks || []).map((link) => {
        const normalized = normalizeUrl(link.url, targetUrl || page.url || undefined);
        const inferredStatus = normalized ? statusByUrl.get(normalized) : null;

        return {
          ...link,
          status: inferredStatus ?? link.status ?? null,
        };
      });
      const externalLinks = page.externalLinks || [];
      const brokenLinks = [
        ...internalLinks.filter((link) => this.isBrokenLinkStatus(link.status, { linkUrl: link.url })),
        ...externalLinks.filter((link) =>
          this.isBrokenLinkStatus(link.status, {
            isExternal: true,
            linkUrl: link.url,
          })),
      ];

      return {
        ...page,
        brokenLinks,
        externalLinks,
        internalLinks,
        linkStats: {
          ...(page.linkStats || {}),
          brokenCount: brokenLinks.length,
          externalCount: externalLinks.length,
          outgoingInternalLinkCount: internalLinks.length,
        },
      };
    });
  }

  getLinkQueueOptions(audit) {
    return {
      concurrency: Math.min(16, Math.max(6, audit.config.concurrency * 3)),
      delayMs: Math.min(150, Math.max(25, Math.floor(audit.config.rateLimitMs / 3))),
    };
  }

  getPreferredRenderUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";

      if (parsed.pathname !== "/" && !parsed.pathname.endsWith("/") && !lastSegment.includes(".")) {
        parsed.pathname = `${parsed.pathname}/`;
      }

      return parsed.toString();
    } catch (_error) {
      return rawUrl;
    }
  }

  buildHeaders(audit, extraHeaders = {}) {
    const headers = {
      "User-Agent": audit.config.userAgent,
      "Accept-Language": "en-US,en;q=0.9",
      ...extraHeaders,
    };

    if (audit.runtime?.session?.cookieHeader) {
      headers.Cookie = audit.runtime.session.cookieHeader;
    }

    return headers;
  }

  async requestUrlText(audit, url, extraHeaders = {}) {
    const response = await axios.get(url, {
      headers: this.buildHeaders(audit, extraHeaders),
      responseType: "text",
      timeout: audit.config.timeoutMs,
      validateStatus: () => true,
    });

    return typeof response.data === "string" ? response.data : "";
  }

  updateProgress(audit) {
    const queueStats = audit.runtime?.pageQueue?.getStats?.() || {
      activeCount: 0,
      pendingCount: 0,
    };

    audit.progress.discovered = audit.runtime?.queuedUrls?.size || audit.progress.discovered;
    audit.progress.remaining = queueStats.pendingCount + queueStats.activeCount;

    if (audit.progress.discovered > 0) {
      const rawPercent = Math.round((audit.progress.crawled / audit.progress.discovered) * 100);
      audit.progress.percent = audit.status === "completed" ? 100 : Math.min(rawPercent, 99);
    }

    audit.updatedAt = new Date().toISOString();
  }

  buildSummary(pages, advanced, taskSummary, startedAt) {
    const totals = {
      brokenLinks: 0,
      externalLinks: 0,
      missingAltPages: 0,
      missingDescriptionPages: 0,
      missingTitlePages: 0,
      noindexPages: 0,
      openTasks: taskSummary?.byStatus?.open || 0,
      orphanPages: 0,
      totalIssues: 0,
      totalPages: pages.length,
      totalTasks: taskSummary?.total || 0,
    };

    for (const page of pages) {
      totals.brokenLinks += page.brokenLinks.length;
      totals.externalLinks += page.externalLinks.length;
      totals.missingAltPages += page.issues.missingAlt ? 1 : 0;
      totals.missingDescriptionPages += page.issues.missingDescription ? 1 : 0;
      totals.missingTitlePages += page.issues.missingTitle ? 1 : 0;
      totals.noindexPages += page.issues.noindexDirective ? 1 : 0;
      totals.orphanPages += page.issues.orphanPage ? 1 : 0;
      totals.totalIssues += Object.keys(page.issueDetails || {}).length;
    }

    return {
      completedAt: new Date().toISOString(),
      duplicateDescriptions: advanced.duplicateDescriptions,
      duplicateTitles: advanced.duplicateTitles,
      durationMs: startedAt ? new Date().getTime() - new Date(startedAt).getTime() : 0,
      taskSummary,
      totals,
    };
  }

  async loadAuditRecord(auditId) {
    if (this.jobs.has(auditId)) {
      return this.jobs.get(auditId);
    }

    try {
      const stored = await this.auditRepository.findById(auditId);

      if (!stored) {
        return null;
      }

      return this.hydrateAudit(stored);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async persistAudit(audit) {
    await this.auditRepository.upsert(this.serializeAudit(audit));
  }

  serializeAudit(audit, options = {}) {
    const hydrated = this.hydrateAudit(audit);
    const includePages = options.includePages !== false;
    const includeTasks = options.includeTasks !== false;

    return {
      id: hydrated.id,
      createdAt: hydrated.createdAt,
      updatedAt: hydrated.updatedAt,
      status: hydrated.status,
      error: hydrated.error,
      config: hydrated.config,
      progress: hydrated.progress,
      pages: includePages
        ? hydrated.pages.map((page) => {
            const sanitizedPage = { ...page };
            delete sanitizedPage.pendingLinkChecks;
            return sanitizedPage;
          })
        : [],
      summary: hydrated.summary,
      tasks: includeTasks ? hydrated.tasks : [],
      taskSummary: hydrated.taskSummary,
    };
  }
  findPageIndex(audit, pageUrl) {
    const normalizedTarget = normalizeUrl(pageUrl, audit.config.targetUrl || undefined) || pageUrl;

    return (audit.pages || []).findIndex((page) => {
      const candidates = [page.url, page.finalUrl]
        .map((value) => normalizeUrl(value, audit.config.targetUrl || undefined) || value)
        .filter(Boolean);

      return candidates.includes(normalizedTarget);
    });
  }

  mergePageWorkflowState(previousPages = [], nextPages = []) {
    const workflowByUrl = new Map(
      previousPages
        .filter((page) => page.reviewStatus)
        .map((page) => [
          page.url,
          {
            reviewStatus: page.reviewStatus,
            reviewStatusUpdatedAt: page.reviewStatusUpdatedAt || null,
          },
        ]),
    );

    return nextPages.map((page) => {
      const workflowState = workflowByUrl.get(page.url);

      if (!workflowState) {
        return page;
      }

      return {
        ...page,
        ...workflowState,
      };
    });
  }
}

module.exports = AuditService;
