import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExportButtons from '../components/ExportButtons';
import Filters from '../components/Filters';
import TableView from '../components/TableView';
import TaskBoard from '../components/TaskBoard';
import { getAudit, pauseAudit, resumeAudit } from '../services/api';
import {
  buildDashboardMetrics,
  buildTabCounts,
  filterPagesByView,
  filterTasksByView,
  formatDuration,
  formatNumber,
  getViewModesForTab,
} from '../utils/formatData';

function Dashboard() {
  const { auditId } = useParams();
  const [audit, setAudit] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [pageSearchTerm, setPageSearchTerm] = useState('');
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [pageStatusFilter, setPageStatusFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all');
  const [taskDateFilter, setTaskDateFilter] = useState('all');
  const [pageViewMode, setPageViewMode] = useState('list');
  const [taskViewMode, setTaskViewMode] = useState('list');
  const [error, setError] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timerId;

    const loadAudit = async () => {
      try {
        const nextAudit = await getAudit(auditId);

        if (!cancelled) {
          setAudit(nextAudit);
          setError('');
        }

        if (!cancelled && ['queued', 'running'].includes(nextAudit.status)) {
          timerId = window.setTimeout(loadAudit, 3000);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      }
    };

    loadAudit();

    return () => {
      cancelled = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [auditId]);

  const metrics = useMemo(() => buildDashboardMetrics(audit), [audit]);
  const taskCategories = useMemo(
    () => Object.keys(audit?.taskSummary?.byCategory || {}).sort((left, right) => left.localeCompare(right)),
    [audit],
  );
  const tabCounts = useMemo(() => buildTabCounts(audit?.pages || [], audit?.tasks || []), [audit]);
  const filteredPages = useMemo(
    () => filterPagesByView(audit?.pages || [], activeTab, pageSearchTerm, pageStatusFilter),
    [activeTab, audit, pageSearchTerm, pageStatusFilter],
  );
  const filteredTasks = useMemo(
    () => filterTasksByView(audit?.tasks || [], taskSearchTerm, taskStatusFilter, taskCategoryFilter, taskDateFilter),
    [audit, taskCategoryFilter, taskDateFilter, taskSearchTerm, taskStatusFilter],
  );

  const currentSearchTerm = activeTab === 'tasks' ? taskSearchTerm : pageSearchTerm;
  const currentStatusFilter = activeTab === 'tasks' ? taskStatusFilter : pageStatusFilter;
  const currentViewMode = activeTab === 'tasks' ? taskViewMode : pageViewMode;
  const currentViewModes = getViewModesForTab(activeTab);

  const handlePauseResume = async () => {
    if (!audit) {
      return;
    }

    setIsMutating(true);

    try {
      const updatedAudit = audit.status === 'paused' ? await resumeAudit(audit.id) : await pauseAudit(audit.id);
      const hydratedAudit = await getAudit(updatedAudit.id);
      setAudit(hydratedAudit);
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSearchChange = (value) => {
    if (activeTab === 'tasks') {
      setTaskSearchTerm(value);
      return;
    }

    setPageSearchTerm(value);
  };

  const handleStatusFilterChange = (value) => {
    if (activeTab === 'tasks') {
      setTaskStatusFilter(value);
      return;
    }

    setPageStatusFilter(value);
  };

  const handleTaskUpdated = (result) => {
    setAudit((current) => {
      if (!current) {
        return current;
      }

      const nextTasks = (current.tasks || []).map((task) => (task.id === result.task.id ? result.task : task));

      return {
        ...current,
        taskSummary: result.taskSummary,
        tasks: nextTasks,
        updatedAt: result.updatedAt,
      };
    });
  };

  const handleAuditReplaced = (nextAudit) => {
    setAudit(nextAudit);
  };

  const handleViewModeChange = (value) => {
    if (activeTab === 'tasks') {
      setTaskViewMode(value);
      return;
    }

    setPageViewMode(value);
  };

  if (error && !audit) {
    return (
      <section className="panel">
        <p className="error-text">{error}</p>
        <Link to="/" className="primary-link">
          Start a new audit
        </Link>
      </section>
    );
  }

  if (!audit) {
    return (
      <section className="panel">
        <p className="muted">Loading audit...</p>
      </section>
    );
  }

  const exportItems = activeTab === 'tasks' ? filteredTasks : filteredPages;
  const boardTitle = audit.config?.targetUrl || audit.config?.manualUrls?.[0] || 'SEO workflow board';
  const openTaskCount = audit.taskSummary?.byStatus?.open || 0;
  const progressPercent = audit.progress?.percent || 0;

  return (
    <div className="stack-page board-page">
      <section className="panel compact-panel board-toolbar">
        <div className="board-toolbar-top">
          <div className="board-toolbar-brand">
            <span className="board-toolbar-icon">S</span>
            <div className="board-toolbar-copy">
              <div className="board-toolbar-breadcrumb">
                <span>Board</span>
                <span>/</span>
                <span>SEO Workflow</span>
              </div>
              <h2>{boardTitle}</h2>
            </div>
            <span
              className={`status-pill board-status-pill ${
                audit.status === 'completed' ? 'success' : audit.status === 'failed' ? 'danger' : 'warning'
              }`}
            >
              {audit.status}
            </span>
          </div>

          <div className="board-toolbar-actions">
            <ExportButtons
              activeTab={activeTab}
              auditId={audit.id}
              buttonClassName="secondary-button compact-button"
              items={exportItems}
              mode={activeTab === 'tasks' ? 'tasks' : 'pages'}
            />
            <Link to="/" className="secondary-button compact-button anchor-button">
              New Audit
            </Link>
            {['running', 'paused'].includes(audit.status) ? (
              <button type="button" className="secondary-button compact-button" onClick={handlePauseResume} disabled={isMutating}>
                {audit.status === 'paused' ? 'Resume Crawl' : 'Pause Crawl'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="board-toolbar-bottom">
          <div className="board-chip-strip">
            <span className="board-chip">Mode {audit.config?.mode}</span>
            <span className="board-chip">Deep scan {audit.config?.deepScan ? 'On' : 'Off'}</span>
            <span className="board-chip">Pages {formatNumber(audit.progress?.crawled)}</span>
            <span className="board-chip">Open {formatNumber(openTaskCount)}</span>
            <span className="board-chip">Duration {formatDuration(audit.summary?.durationMs)}</span>
            <span className="board-chip">Current {audit.progress?.currentUrl || 'Idle'}</span>
          </div>

          <div className="board-toolbar-meta">
            <div className="board-mini-progress">
              <span>{progressPercent}%</span>
              <div className="board-progress-rail">
                <div className="board-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div className="board-member-stack" aria-hidden="true">
              <span className="board-member">SEO</span>
              <span className="board-member">DEV</span>
              <span className="board-member">QA</span>
            </div>
          </div>
        </div>

        <div className="metric-ribbon">
          {metrics.map((metric) => (
            <article key={metric.label} className="metric-card compact-metric-card">
              <span>{metric.label}</span>
              <strong>{formatNumber(metric.value)}</strong>
            </article>
          ))}
        </div>

        {error ? <p className="error-text compact-message">{error}</p> : null}
        {!error && audit.status === 'failed' && audit.error ? (
          <p className="error-text compact-message">{audit.error}</p>
        ) : null}
      </section>

      <Filters
        activeTab={activeTab}
        categoryFilter={taskCategoryFilter}
        categoryOptions={taskCategories}
        counts={tabCounts}
        dateFilter={taskDateFilter}
        onCategoryFilterChange={setTaskCategoryFilter}
        onDateFilterChange={setTaskDateFilter}
        onSearchChange={handleSearchChange}
        onStatusFilterChange={handleStatusFilterChange}
        onTabChange={setActiveTab}
        onViewModeChange={handleViewModeChange}
        searchTerm={currentSearchTerm}
        statusFilter={currentStatusFilter}
        viewMode={currentViewMode}
        viewModes={currentViewModes}
      />

      {activeTab === 'tasks' ? (
        <TaskBoard
          auditId={audit.id}
          filteredTasks={filteredTasks}
          onAuditReplaced={handleAuditReplaced}
          onAuditTaskUpdated={handleTaskUpdated}
          taskSummary={audit.taskSummary}
          viewMode={taskViewMode}
        />
      ) : (
        <TableView
          activeTab={activeTab}
          audit={audit}
          auditId={audit.id}
          onAuditReplaced={handleAuditReplaced}
          pages={filteredPages}
          viewMode={pageViewMode}
        />
      )}
    </div>
  );
}

export default Dashboard;
