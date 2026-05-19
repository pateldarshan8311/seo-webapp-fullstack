import { useEffect, useMemo, useState } from 'react';
import DetailModal from './DetailModal';
import { updateAuditPage } from '../services/api';
import {
  PAGE_REVIEW_STATUS_OPTIONS,
  formatNumber,
  getIssueCount,
  getPageBoardColumns,
  getPageHealthBucket,
  getPageHealthLabel,
  humanizeIssueKey,
} from '../utils/formatData';

function renderLinkItem(item) {
  const href = typeof item === 'string' ? item : item.url;
  const status = typeof item === 'string' ? null : item.status;

  return (
    <a key={`${href}-${status || 'link'}`} href={href} target="_blank" rel="noreferrer" className="list-link">
      {href}
      {status ? <span className="status-pill subtle">{status}</span> : null}
    </a>
  );
}

function renderIssueTag(issueKey) {
  return (
    <span key={issueKey} className="issue-tag">
      {humanizeIssueKey(issueKey)}
    </span>
  );
}

function getColumnTone(columnKey) {
  if (columnKey === 'critical') {
    return 'lane-amber';
  }

  if (columnKey === 'warning') {
    return 'lane-violet';
  }

  return 'lane-green';
}

function getPageStatusLabel(status) {
  return PAGE_REVIEW_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function getActiveIssueKeys(activeTab, page) {
  const allKeys = Object.keys(page.issueDetails || {});
  const issueGroups = {
    alt: ['missingAlt'],
    broken: ['brokenLinks', 'redirectChain', 'redirected'],
    content: ['thinContent', 'missingH1', 'multipleH1', 'orphanPage', 'deepPage'],
    external: ['brokenLinks'],
    meta: [
      'missingTitle',
      'missingDescription',
      'duplicateTitle',
      'duplicateDescription',
      'missingCanonical',
      'invalidCanonical',
      'canonicalMismatch',
      'crossDomainCanonical',
      'titleTooLong',
      'titleTooShort',
      'descriptionTooLong',
      'descriptionTooShort',
    ],
    technical: [
      'missingLang',
      'missingViewport',
      'noindexDirective',
      'nofollowDirective',
      'missingOpenGraph',
      'missingTwitterCard',
      'mixedContent',
      'slowResponse',
      'missingStructuredData',
      'invalidStructuredData',
      'redirectChain',
      'redirected',
    ],
  };

  if (!issueGroups[activeTab]) {
    return allKeys;
  }

  return allKeys.filter((issueKey) => issueGroups[activeTab].includes(issueKey));
}

function CompactPageCard({
  activeTab,
  isDragging,
  onOpenDetails,
  onPageStatusChange,
  onPointerStart,
  page,
  savingPageUrl,
}) {
  const healthBucket = getPageHealthBucket(page);
  const issueKeys = getActiveIssueKeys(activeTab, page);

  return (
    <article className={`page-card compact-card draggable-card ${healthBucket} ${isDragging ? 'dragging' : ''}`}>
      <div className="task-chip-row">
        <span className={`mini-pill ${(page.status || 0) >= 400 ? 'danger' : 'success'}`}>{page.status || 'N/A'}</span>
        <span className={`mini-pill ${healthBucket === 'critical' ? 'danger' : healthBucket === 'warning' ? 'warning' : 'success'}`}>
          {getPageHealthLabel(page)}
        </span>
      </div>

      <button type="button" className="card-open-button" onClick={() => onOpenDetails(page.url)}>
        <strong className="compact-card-title">{page.title || 'Untitled page'}</strong>
        <span className="compact-link static-link">{page.url}</span>

        <div className="compact-chip-strip">
          <span>{formatNumber(page.wordCount || 0)} words</span>
          <span>{formatNumber(issueKeys.length)} issues</span>
          <span>{formatNumber(page.responseTimeMs || 0)} ms</span>
        </div>
      </button>

      <div className="card-utility-row page-card-actions">
        <select
          className="compact-select page-status-select"
          value={healthBucket}
          disabled={savingPageUrl === page.url}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onPageStatusChange(page.url, event.target.value)}
        >
          {PAGE_REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" className="drag-handle" aria-label={`Move ${page.title || page.url}`} onPointerDown={(event) => onPointerStart(event, page.url)}>
          ::
        </button>
      </div>
    </article>
  );
}

function RichPageCard({ activeTab, onOpenDetails, onPageStatusChange, page, savingPageUrl }) {
  const healthBucket = getPageHealthBucket(page);

  return (
    <article className={`page-card card-surface ${healthBucket}`}>
      <div className="card-top">
        <span className={`status-pill ${(page.status || 0) >= 400 ? 'danger' : 'success'}`}>{page.status || 'N/A'}</span>
        <span className={`status-pill ${healthBucket === 'critical' ? 'danger' : healthBucket === 'warning' ? 'warning' : 'success'}`}>
          {getPageHealthLabel(page)}
        </span>
      </div>

      <button type="button" className="card-open-button rich-card-open" onClick={() => onOpenDetails(page.url)}>
        <div className="stack-list">
          <strong className="card-title">{page.title || 'Untitled page'}</strong>
          <span className="primary-link static-link">{page.url}</span>
          {page.description ? <p className="muted card-copy">{page.description}</p> : null}
        </div>

        <div className="card-meta-grid">
          <span>{formatNumber(page.wordCount || 0)} words</span>
          <span>{page.crawlDepth || 0} depth</span>
          <span>{formatNumber(page.responseTimeMs || 0)} ms</span>
        </div>

        <div className="chip-row">
          <span className="summary-chip">Issues {getIssueCount(page)}</span>
          <span className="summary-chip">Images {page.imageStats?.totalImages || 0}</span>
          <span className="summary-chip">H1 {page.headingStats?.h1Count || 0}</span>
        </div>
      </button>

      <div className="card-utility-row page-card-actions">
        <select
          className="compact-select page-status-select"
          value={healthBucket}
          disabled={savingPageUrl === page.url}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onPageStatusChange(page.url, event.target.value)}
        >
          {PAGE_REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function PageDetailsPanel({ activeTab, onPageStatusChange, page, savingPageUrl }) {
  const issueKeys = getActiveIssueKeys(activeTab, page);
  const healthBucket = getPageHealthBucket(page);
  const missingAltImages = (page.images || []).filter((image) => image.missingAlt);

  return (
    <div className="modal-stack">
      <div className="modal-chip-row">
        <span className={`mini-pill ${(page.status || 0) >= 400 ? 'danger' : 'success'}`}>{page.status || 'N/A'}</span>
        <span className={`mini-pill ${healthBucket === 'critical' ? 'danger' : healthBucket === 'warning' ? 'warning' : 'success'}`}>
          {getPageHealthLabel(page)}
        </span>
        <span className="summary-chip">{formatNumber(issueKeys.length)} issues</span>
      </div>

      <a href={page.url} target="_blank" rel="noreferrer" className="primary-link">
        {page.url}
      </a>

      <div className="detail-grid compact-details">
        <label className="field compact-inline">
          <span>Workflow status</span>
          <select
            className="inline-select"
            value={healthBucket}
            disabled={savingPageUrl === page.url}
            onChange={(event) => onPageStatusChange(page.url, event.target.value)}
          >
            {PAGE_REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="detail-item">
          <span>Final URL</span>
          <strong>{page.finalUrl || page.url}</strong>
        </div>
        <div className="detail-item">
          <span>Word count</span>
          <strong>{formatNumber(page.wordCount || 0)}</strong>
        </div>
        <div className="detail-item">
          <span>Response time</span>
          <strong>{formatNumber(page.responseTimeMs || 0)} ms</strong>
        </div>
        <div className="detail-item">
          <span>Crawl depth</span>
          <strong>{page.crawlDepth || 0}</strong>
        </div>
        <div className="detail-item">
          <span>Canonical</span>
          <strong>{page.canonical || 'Missing'}</strong>
        </div>
        <div className="detail-item">
          <span>Keywords</span>
          <strong>{page.keywords || 'None'}</strong>
        </div>
      </div>

      {page.description ? (
        <section className="detail-section">
          <h4>Description</h4>
          <p className="muted detail-copy">{page.description}</p>
        </section>
      ) : null}

      <section className="detail-section">
        <h4>Headings</h4>
        <div className="detail-columns">
          <div className="detail-block">
            <strong>H1</strong>
            {(page.h1 || []).length
              ? (page.h1 || []).map((heading, index) => <span key={`h1-${index}-${heading}`}>{heading}</span>)
              : <span className="muted">No H1 tags</span>}
          </div>
          <div className="detail-block">
            <strong>H2</strong>
            {(page.h2 || []).length
              ? (page.h2 || []).map((heading, index) => <span key={`h2-${index}-${heading}`}>{heading}</span>)
              : <span className="muted">No H2 tags</span>}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h4>Issues</h4>
        <div className="modal-chip-row">
          {issueKeys.length ? issueKeys.map((issueKey) => renderIssueTag(issueKey)) : <span className="muted">No issues in this view.</span>}
        </div>
      </section>

      <section className="detail-section">
        <h4>Links</h4>
        <div className="detail-columns">
          <div className="detail-block">
            <strong>Broken links</strong>
            {(page.brokenLinks || []).length ? (page.brokenLinks || []).map((item) => renderLinkItem(item)) : <span className="muted">No broken links</span>}
          </div>
          <div className="detail-block">
            <strong>External links</strong>
            {(page.externalLinks || []).length ? (page.externalLinks || []).map((item) => renderLinkItem(item)) : <span className="muted">No external links</span>}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h4>Images</h4>
        <div className="detail-grid compact-details">
          <div className="detail-item">
            <span>Total images</span>
            <strong>{page.imageStats?.totalImages || 0}</strong>
          </div>
          <div className="detail-item">
            <span>Missing alt</span>
            <strong>{page.imageStats?.missingAltCount || 0}</strong>
          </div>
        </div>
        <div className="detail-block">
          {missingAltImages.length ? missingAltImages.map((image) => renderLinkItem(image.src)) : <span className="muted">No missing alt examples</span>}
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="panel compact-panel">
      <p className="muted">No cards match the current filters.</p>
    </section>
  );
}

function ListPageTable({ activeTab, onOpenDetails, onPageStatusChange, pages, savingPageUrl }) {
  return (
    <section className="panel table-panel">
      <div className="table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>HTTP</th>
              <th>Workflow</th>
              <th>Title</th>
              <th>H1</th>
              <th>Words</th>
              <th>Internal</th>
              <th>External</th>
              <th>Broken</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => {
              const issueKeys = getActiveIssueKeys(activeTab, page);
              const healthBucket = getPageHealthBucket(page);

              return (
                <tr key={page.url}>
                  <td>
                    <button type="button" className="inline-button" onClick={() => onOpenDetails(page.url)}>
                      {page.url}
                    </button>
                  </td>
                  <td>
                    <span className={`status-pill ${(page.status || 0) >= 400 ? 'danger' : 'success'}`}>{page.status || 'N/A'}</span>
                  </td>
                  <td>
                    <select
                      className="compact-select"
                      value={healthBucket}
                      disabled={savingPageUrl === page.url}
                      onChange={(event) => onPageStatusChange(page.url, event.target.value)}
                    >
                      {PAGE_REVIEW_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{page.title || <span className="muted">Untitled</span>}</td>
                  <td>{page.h1?.[0] || <span className="muted">Missing</span>}</td>
                  <td>{formatNumber(page.wordCount || 0)}</td>
                  <td>{formatNumber(page.internalLinks?.length || 0)}</td>
                  <td>{formatNumber(page.externalLinks?.length || 0)}</td>
                  <td>{formatNumber(page.brokenLinks?.length || 0)}</td>
                  <td>
                    {issueKeys.length ? (
                      <div className="table-issue-stack">
                        <strong>{formatNumber(issueKeys.length)}</strong>
                        <span>{issueKeys.slice(0, 3).map(humanizeIssueKey).join(', ')}</span>
                      </div>
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableView({ activeTab, auditId, onAuditReplaced, pages, viewMode = 'board' }) {
  const [activePageUrl, setActivePageUrl] = useState('');
  const [savingPageUrl, setSavingPageUrl] = useState('');
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [draggedPageUrl, setDraggedPageUrl] = useState('');
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragOverColumn, setDragOverColumn] = useState('');
  const activePage = pages.find((page) => page.url === activePageUrl) || null;
  const draggedPage = pages.find((page) => page.url === draggedPageUrl) || null;
  const columns = useMemo(() => getPageBoardColumns(pages), [pages]);

  useEffect(() => {
    setActivePageUrl((current) => (pages.some((page) => page.url === current) ? current : ''));
  }, [pages]);

  useEffect(() => {
    if (!draggedPageUrl || viewMode !== 'board') {
      return undefined;
    }

    const getDropColumnFromPoint = (clientX, clientY) => {
      const dropZone = document.elementFromPoint(clientX, clientY)?.closest('[data-drop-column]');
      return dropZone?.getAttribute('data-drop-column') || '';
    };

    const handlePointerMove = (event) => {
      setDragPosition({ x: event.clientX, y: event.clientY });
      setDragOverColumn(getDropColumnFromPoint(event.clientX, event.clientY));
    };

    const handlePointerCancel = () => {
      setDraggedPageUrl('');
      setDragOverColumn('');
    };

    const handlePointerUp = async (event) => {
      const nextStatus = getDropColumnFromPoint(event.clientX, event.clientY);
      const page = pages.find((item) => item.url === draggedPageUrl);

      setDraggedPageUrl('');
      setDragOverColumn('');

      if (page && nextStatus) {
        await handlePageStatusChange(page.url, nextStatus);
      }
    };

    document.body.classList.add('dragging-board');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      document.body.classList.remove('dragging-board');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [draggedPageUrl, pages, viewMode]);

  const handlePageStatusChange = async (pageUrl, reviewStatus) => {
    setSavingPageUrl(pageUrl);
    setBanner('');
    setError('');

    try {
      const result = await updateAuditPage(auditId, { reviewStatus, url: pageUrl });
      onAuditReplaced(result.audit);
      setBanner(`Moved page to ${getPageStatusLabel(reviewStatus)}.`);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingPageUrl('');
    }
  };

  const handlePointerStart = (event, pageUrl) => {
    if (viewMode !== 'board') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setDraggedPageUrl(pageUrl);
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDragOverColumn('');
  };

  if (!pages.length) {
    return <EmptyState />;
  }

  return (
    <>
      {banner ? <p className="success-text compact-message">{banner}</p> : null}
      {error ? <p className="error-text compact-message">{error}</p> : null}

      {viewMode === 'board' ? (
        <section className="board-scroll">
          <div className="board-layout compact-board-layout">
            {columns.map((column) => (
              <div
                key={column.key}
                data-drop-column={column.key}
                className={`board-column compact-board-column ${getColumnTone(column.key)} ${dragOverColumn === column.key ? 'drag-over' : ''}`}
              >
                <div className="board-column-header compact-board-header">
                  <strong>{column.label}</strong>
                  <span className="summary-chip">{column.items.length}</span>
                </div>
                <div className="board-column-body compact-board-body">
                  {column.items.length === 0 ? <p className="muted">No pages here.</p> : null}
                  {column.items.map((page) => (
                    <CompactPageCard
                      key={page.url}
                      activeTab={activeTab}
                      isDragging={draggedPageUrl === page.url}
                      onOpenDetails={setActivePageUrl}
                      onPageStatusChange={handlePageStatusChange}
                      onPointerStart={handlePointerStart}
                      page={page}
                      savingPageUrl={savingPageUrl}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : viewMode === 'list' ? (
        <ListPageTable
          activeTab={activeTab}
          onOpenDetails={setActivePageUrl}
          onPageStatusChange={handlePageStatusChange}
          pages={pages}
          savingPageUrl={savingPageUrl}
        />
      ) : (
        <section className={viewMode === 'list' ? 'compact-list' : 'compact-grid'}>
          {pages.map((page) => (
            <RichPageCard
              key={page.url}
              activeTab={activeTab}
              onOpenDetails={setActivePageUrl}
              onPageStatusChange={handlePageStatusChange}
              page={page}
              savingPageUrl={savingPageUrl}
            />
          ))}
        </section>
      )}

      {draggedPage && viewMode === 'board' ? (
        <div
          className="drag-preview"
          style={{
            left: `${dragPosition.x + 14}px`,
            top: `${dragPosition.y + 14}px`,
          }}
        >
          <span className={`mini-pill ${getPageHealthBucket(draggedPage) === 'critical' ? 'danger' : getPageHealthBucket(draggedPage) === 'warning' ? 'warning' : 'success'}`}>
            {getPageHealthLabel(draggedPage)}
          </span>
          <strong>{draggedPage.title || draggedPage.url}</strong>
        </div>
      ) : null}

      {activePage ? (
        <DetailModal subtitle="Page details" title={activePage.title || activePage.url} onClose={() => setActivePageUrl('')}>
          <PageDetailsPanel
            activeTab={activeTab}
            onPageStatusChange={handlePageStatusChange}
            page={activePage}
            savingPageUrl={savingPageUrl}
          />
        </DetailModal>
      ) : null}
    </>
  );
}

export default TableView;
