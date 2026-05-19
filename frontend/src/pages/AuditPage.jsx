import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAudits, startAudit } from '../services/api';
import { formatDuration, formatNumber } from '../utils/formatData';

const defaultForm = {
  targetUrl: '',
  mode: 'auto',
  sitemapUrl: '',
  manualUrlsText: '',
  renderJs: false,
  deepScan: true,
  concurrency: 4,
  rateLimitMs: 250,
  timeoutMs: 20000,
  authMode: 'none',
  cookieString: '',
  loginUrl: '',
  username: '',
  password: '',
  usernameSelector: 'input[name="username"]',
  passwordSelector: 'input[name="password"]',
  submitSelector: 'button[type="submit"]',
  successSelector: '',
};

function AuditPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [recentAudits, setRecentAudits] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listAudits()
      .then((audits) => setRecentAudits(Array.isArray(audits) ? audits : []))
      .catch(() => setRecentAudits([]));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const manualUrls = form.manualUrlsText
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const payload = {
        targetUrl: form.targetUrl,
        mode: form.mode,
        sitemapUrl: form.sitemapUrl,
        manualUrls,
        deepScan: form.deepScan,
        renderJs: form.renderJs,
        concurrency: Number(form.concurrency),
        rateLimitMs: Number(form.rateLimitMs),
        timeoutMs: Number(form.timeoutMs),
      };

      if (form.authMode === 'cookie') {
        payload.auth = {
          cookieString: form.cookieString,
          mode: 'cookie',
        };
      }

      if (form.authMode === 'login') {
        payload.auth = {
          loginUrl: form.loginUrl,
          mode: 'login',
          password: form.password,
          passwordSelector: form.passwordSelector,
          submitSelector: form.submitSelector,
          successSelector: form.successSelector,
          username: form.username,
          usernameSelector: form.usernameSelector,
        };
      }

      const audit = await startAudit(payload);
      navigate(`/audits/${audit.id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid two-column">
      <section className="panel hero-panel">
        <p className="eyebrow">Crawler Control Center</p>
        <h2>Launch sitemap, recursive, or manual-page audits from one place.</h2>
        <p className="lead">
          This app crawls every discovered page, extracts SEO signals, checks link health, detects duplication, and
          stores runs locally for later review.
        </p>
        <p className="muted">
          Local dev requires both apps running: frontend on <strong>5173</strong> and backend on <strong>4000</strong>.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Target website</span>
            <input
              type="url"
              placeholder="https://example.com"
              value={form.targetUrl}
              onChange={(event) => updateField('targetUrl', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Crawl mode</span>
            <select value={form.mode} onChange={(event) => updateField('mode', event.target.value)}>
              <option value="auto">Automatic crawl</option>
              <option value="sitemap">Sitemap crawl</option>
              <option value="manual">Manual URL list</option>
            </select>
          </label>

          {form.mode === 'sitemap' ? (
            <label className="field">
              <span>Sitemap URL</span>
              <input
                type="url"
                placeholder="https://example.com/sitemap.xml"
                value={form.sitemapUrl}
                onChange={(event) => updateField('sitemapUrl', event.target.value)}
              />
            </label>
          ) : null}

          {form.mode === 'manual' ? (
            <label className="field full-width">
              <span>Manual URLs</span>
              <textarea
                rows="5"
                placeholder="https://example.com/page-one&#10;https://example.com/page-two"
                value={form.manualUrlsText}
                onChange={(event) => updateField('manualUrlsText', event.target.value)}
              />
            </label>
          ) : null}

          <label className="field compact">
            <span>Concurrency</span>
            <input
              type="number"
              min="1"
              max="12"
              value={form.concurrency}
              onChange={(event) => updateField('concurrency', event.target.value)}
            />
          </label>

          <label className="field compact">
            <span>Rate limit (ms)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={form.rateLimitMs}
              onChange={(event) => updateField('rateLimitMs', event.target.value)}
            />
          </label>

          <label className="field compact">
            <span>Timeout (ms)</span>
            <input
              type="number"
              min="3000"
              step="1000"
              value={form.timeoutMs}
              onChange={(event) => updateField('timeoutMs', event.target.value)}
            />
          </label>

          <label className="checkbox-field full-width">
            <input
              type="checkbox"
              checked={form.deepScan}
              onChange={(event) => updateField('deepScan', event.target.checked)}
            />
            <span>Enable deep technical scan for indexing, schema, content, and performance checks</span>
          </label>

          <label className="checkbox-field full-width">
            <input
              type="checkbox"
              checked={form.renderJs}
              onChange={(event) => updateField('renderJs', event.target.checked)}
            />
            <span>Render JavaScript pages with Puppeteer</span>
          </label>

          <label className="field">
            <span>Authentication mode</span>
            <select value={form.authMode} onChange={(event) => updateField('authMode', event.target.value)}>
              <option value="none">No auth</option>
              <option value="cookie">Cookie/session string</option>
              <option value="login">Login form</option>
            </select>
          </label>

          {form.authMode === 'cookie' ? (
            <label className="field full-width">
              <span>Cookie header</span>
              <textarea
                rows="3"
                placeholder="sessionid=abc123; csrftoken=xyz789"
                value={form.cookieString}
                onChange={(event) => updateField('cookieString', event.target.value)}
              />
            </label>
          ) : null}

          {form.authMode === 'login' ? (
            <>
              <label className="field">
                <span>Login URL</span>
                <input
                  type="url"
                  placeholder="https://example.com/login"
                  value={form.loginUrl}
                  onChange={(event) => updateField('loginUrl', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Username</span>
                <input value={form.username} onChange={(event) => updateField('username', event.target.value)} />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Username selector</span>
                <input
                  value={form.usernameSelector}
                  onChange={(event) => updateField('usernameSelector', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Password selector</span>
                <input
                  value={form.passwordSelector}
                  onChange={(event) => updateField('passwordSelector', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Submit selector</span>
                <input
                  value={form.submitSelector}
                  onChange={(event) => updateField('submitSelector', event.target.value)}
                />
              </label>

              <label className="field full-width">
                <span>Success selector</span>
                <input
                  placeholder=".account-dashboard"
                  value={form.successSelector}
                  onChange={(event) => updateField('successSelector', event.target.value)}
                />
              </label>
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Starting audit...' : 'Start Audit'}
            </button>
          </div>
        </form>
      </section>

      <aside className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Stored Runs</p>
            <h3>Recent audits</h3>
          </div>
        </div>

        <div className="audit-list">
          {recentAudits.length === 0 ? <p className="muted">No stored audits yet.</p> : null}

          {recentAudits.map((audit) => (
            <button key={audit.id} type="button" className="audit-card" onClick={() => navigate(`/audits/${audit.id}`)}>
              <div className="audit-card-top">
                <span
                  className={`status-pill ${
                    audit.status === 'completed' ? 'success' : audit.status === 'failed' ? 'danger' : 'warning'
                  }`}
                >
                  {audit.status}
                </span>
                <span className="muted">{new Date(audit.createdAt).toLocaleString()}</span>
              </div>
              <strong>{audit.config?.targetUrl || audit.config?.manualUrls?.[0] || 'Manual audit'}</strong>
              <div className="stack-list">
                <span>Pages: {formatNumber(audit.summary?.totals?.totalPages || 0)}</span>
                <span>Duration: {formatDuration(audit.summary?.durationMs)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default AuditPage;
