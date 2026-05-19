const puppeteer = require("puppeteer");

function buildCookieHeader(cookies = []) {
  return cookies
    .filter((cookie) => cookie?.name)
    .map((cookie) => `${cookie.name}=${cookie.value || ""}`)
    .join("; ");
}

function parseCookieString(cookieString, targetUrl) {
  if (!cookieString || !targetUrl) {
    return [];
  }

  const parsedUrl = new URL(targetUrl);

  return cookieString
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const separatorIndex = segment.indexOf("=");
      const name = separatorIndex >= 0 ? segment.slice(0, separatorIndex).trim() : segment.trim();
      const value = separatorIndex >= 0 ? segment.slice(separatorIndex + 1).trim() : "";

      return {
        name,
        value,
        domain: parsedUrl.hostname,
        path: "/",
      };
    });
}

async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.launch(launchOptions);
}

async function applyCookiesToPage(page, cookies = [], pageUrl) {
  if (!cookies.length) {
    return;
  }

  const preparedCookies = cookies.map((cookie) => {
    if (cookie.url || cookie.domain) {
      return cookie;
    }

    return {
      ...cookie,
      url: pageUrl,
    };
  });

  await page.setCookie(...preparedCookies);
}

async function applyPageProfile(page, session, pageUrl) {
  if (session?.userAgent) {
    await page.setUserAgent(session.userAgent);
  }

  if (session?.cookies?.length) {
    await applyCookiesToPage(page, session.cookies, pageUrl);
  }
}

async function createSession(authConfig = {}, options = {}) {
  const session = {
    authConfig,
    browser: null,
    cookieHeader: "",
    cookies: [],
    userAgent: options.userAgent || "",
  };

  const cookieString = String(authConfig.cookieString || "").trim();

  if (cookieString) {
    session.cookies = parseCookieString(cookieString, authConfig.loginUrl || options.targetUrl);
    session.cookieHeader = cookieString;
  }

  if (Array.isArray(authConfig.cookies) && authConfig.cookies.length) {
    session.cookies = authConfig.cookies;
    session.cookieHeader = buildCookieHeader(authConfig.cookies);
  }

  const requiresBrowser = Boolean(options.enableBrowser || authConfig.mode === "login");

  if (!requiresBrowser) {
    return session;
  }

  session.browser = await launchBrowser();

  if (authConfig.mode !== "login") {
    return session;
  }

  const page = await session.browser.newPage();

  await applyPageProfile(page, session, authConfig.loginUrl || options.targetUrl);

  await page.goto(authConfig.loginUrl, {
    timeout: authConfig.timeoutMs || 30000,
    waitUntil: authConfig.waitUntil || "networkidle2",
  });

  await page.type(authConfig.usernameSelector || 'input[name="username"]', authConfig.username || "", {
    delay: 25,
  });
  await page.type(authConfig.passwordSelector || 'input[name="password"]', authConfig.password || "", {
    delay: 25,
  });

  const submitSelector = authConfig.submitSelector || 'button[type="submit"], input[type="submit"]';

  await Promise.all([
    page.waitForNavigation({
      timeout: authConfig.timeoutMs || 30000,
      waitUntil: authConfig.waitUntil || "networkidle2",
    }).catch(() => null),
    page.click(submitSelector),
  ]);

  if (authConfig.successSelector) {
    await page.waitForSelector(authConfig.successSelector, {
      timeout: authConfig.timeoutMs || 30000,
    });
  }

  session.cookies = await page.cookies();
  session.cookieHeader = buildCookieHeader(session.cookies);
  await page.close();

  return session;
}

async function renderPageWithSession({ session, url, timeoutMs = 30000 }) {
  if (!session.browser) {
    session.browser = await launchBrowser();
  }

  const page = await session.browser.newPage();
  await applyPageProfile(page, session, url);

  const response = await page.goto(url, {
    timeout: timeoutMs,
    waitUntil: "networkidle2",
  });

  const html = await page.content();
  const finalUrl = page.url();
  const status = response?.status() || 0;
  const headers = response?.headers() || {};

  await page.close();

  return {
    finalUrl,
    headers,
    html,
    status,
  };
}

async function closeSession(session) {
  if (session?.browser) {
    await session.browser.close();
  }
}

module.exports = {
  buildCookieHeader,
  closeSession,
  createSession,
  renderPageWithSession,
};
