import { useEffect, useMemo, useState } from 'react';
import DetailModal from './DetailModal';
import { updateAuditTask, verifyAuditTask, verifyOpenAuditTasks } from '../services/api';
import { TASK_STATUS_OPTIONS, formatDateTime, formatNumber, formatShortDate, getTaskBoardColumns } from '../utils/formatData';

function getSeverityClass(severity) {
  if (severity === 'critical') {
    return 'danger';
  }

  if (severity === 'high') {
    return 'warning';
  }

  if (severity === 'medium') {
    return 'subtle';
  }

  return 'success';
}

function getColumnTone(columnKey) {
  if (columnKey === 'open') {
    return 'lane-blue';
  }

  if (columnKey === 'in_progress') {
    return 'lane-teal';
  }

  if (columnKey === 'fixed') {
    return 'lane-green';
  }

  return 'lane-slate';
}

function getStatusLabel(status) {
  return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label || status.replace('_', ' ');
}

function BoardTaskCard({
  isDragging,
  isSelected,
  onOpenDetails,
  onPointerStart,
  onToggleSelect,
  task,
}) {
  return (
    <article className={`task-card compact-card draggable-card ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected-card' : ''}`}>
      <div className="card-utility-row">
        <label className="card-selector" onClick={(event) => event.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)} />
        </label>
        <span className="board-label">{task.category}</span>
        <span className={`mini-pill ${getSeverityClass(task.severity)}`}>{task.severity}</span>
        <button
          type="button"
          aria-label={`Drag ${task.title}`}
          className="drag-handle"
          onPointerDown={(event) => onPointerStart(event, task.id)}
        >
          ::
        </button>
      </div>

      <button type="button" className="card-open-button" onClick={() => onOpenDetails(task.id)}>
        <strong className="compact-card-title">{task.title}</strong>
        {task.description ? <p className="compact-card-copy">{task.description}</p> : null}
        <span className="compact-link static-link">{task.pageUrl}</span>

        <div className="compact-meta-row">
          <span>{getStatusLabel(task.status)}</span>
          <span>{formatShortDate(task.dueDate || task.updatedAt)}</span>
          <span>{task.assignee || 'Unassigned'}</span>
        </div>
      </button>
    </article>
  );
}

function GridTaskCard({ isSelected, onOpenDetails, onToggleSelect, task }) {
  return (
    <article className={`task-card card-surface ${isSelected ? 'selected-card' : ''}`}>
      <div className="card-top">
        <div className="card-utility-row">
          <label className="card-selector" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)} />
          </label>
          <span className="issue-tag neutral-tag">{task.category}</span>
          <span className={`status-pill ${getSeverityClass(task.severity)}`}>{task.severity}</span>
        </div>
      </div>

      <button type="button" className="card-open-button rich-card-open" onClick={() => onOpenDetails(task.id)}>
        <div className="stack-list">
          <strong className="card-title">{task.title}</strong>
          {task.description ? <p className="muted card-copy">{task.description}</p> : null}
          <span className="primary-link static-link">{task.pageUrl}</span>
        </div>

        <div className="chip-row">
          <span className="summary-chip">{getStatusLabel(task.status)}</span>
          <span className="summary-chip">Updated {formatDateTime(task.updatedAt)}</span>
        </div>
      </button>
    </article>
  );
}

function TaskDetailsPanel({ onTaskUpdate, onTaskVerify, savingTaskId, task }) {
  const isSaving = savingTaskId === task.id;

  return (
    <div className="modal-stack" key={`${task.id}-${task.updatedAt}`}>
      <div className="modal-chip-row">
        <span className="board-label">{task.category}</span>
        <span className={`mini-pill ${getSeverityClass(task.severity)}`}>{task.severity}</span>
        <span className="summary-chip">{getStatusLabel(task.status)}</span>
      </div>

      <a href={task.pageUrl} target="_blank" rel="noreferrer" className="primary-link">
        {task.pageUrl}
      </a>

      <div className="detail-grid">
        <label className="field compact-inline">
          <span>Status</span>
          <select
            className="inline-select"
            value={task.status}
            disabled={isSaving}
            onChange={(event) => onTaskUpdate(task.id, { status: event.target.value })}
          >
            {TASK_STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field compact-inline">
          <span>Due date</span>
          <input
            className="inline-input"
            defaultValue={task.dueDate || ''}
            disabled={isSaving}
            type="date"
            onBlur={(event) => onTaskUpdate(task.id, { dueDate: event.target.value })}
          />
        </label>

        <label className="field compact-inline">
          <span>Assignee</span>
          <input
            className="inline-input"
            defaultValue={task.assignee || ''}
            disabled={isSaving}
            placeholder="Assign"
            type="text"
            onBlur={(event) => onTaskUpdate(task.id, { assignee: event.target.value })}
          />
        </label>

        <label className="field compact-inline full-span">
          <span>Notes</span>
          <textarea
            className="inline-input"
            defaultValue={task.notes || ''}
            disabled={isSaving}
            placeholder="Add implementation notes"
            rows={3}
            onBlur={(event) => onTaskUpdate(task.id, { notes: event.target.value })}
          />
        </label>
      </div>

      <section className="detail-section">
        <h4>Description</h4>
        <p className="muted detail-copy">{task.description || 'No description provided for this task.'}</p>
      </section>

      <section className="detail-section">
        <h4>Timeline</h4>
        <div className="detail-grid compact-details">
          <div className="detail-item">
            <span>Created</span>
            <strong>{formatDateTime(task.createdAt)}</strong>
          </div>
          <div className="detail-item">
            <span>Updated</span>
            <strong>{formatDateTime(task.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <div className="modal-inline-actions">
        <button type="button" className="secondary-button" disabled={isSaving} onClick={() => onTaskVerify(task.id)}>
          Verify & Rescan
        </button>
        <a href={task.pageUrl} target="_blank" rel="noreferrer" className="secondary-button anchor-button">
          Open Page
        </a>
      </div>
    </div>
  );
}

function ListTaskTable({ filteredTasks, onOpenDetails, onToggleSelect, savingTaskId, selectedTaskIds }) {
  return (
    <section className="panel table-panel">
      <div className="table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Task</th>
              <th>Page</th>
              <th>Updated</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    disabled={savingTaskId === 'bulk-selection'}
                    onChange={() => onToggleSelect(task.id)}
                  />
                </td>
                <td>{getStatusLabel(task.status)}</td>
                <td>
                  <span className={`status-pill ${getSeverityClass(task.severity)}`}>{task.severity}</span>
                </td>
                <td>{task.category}</td>
                <td>
                  <button type="button" className="inline-button" onClick={() => onOpenDetails(task.id)}>
                    {task.title}
                  </button>
                </td>
                <td>{task.pageUrl}</td>
                <td>{formatDateTime(task.updatedAt)}</td>
                <td>{task.assignee || <span className="muted">Unassigned</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskBoard({
  auditId,
  filteredTasks = [],
  onAuditReplaced,
  onAuditTaskUpdated,
  taskSummary,
  viewMode = 'board',
}) {
  const [savingTaskId, setSavingTaskId] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState('');
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [activeTaskId, setActiveTaskId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const boardColumns = useMemo(() => getTaskBoardColumns(filteredTasks), [filteredTasks]);
  const activeTask = filteredTasks.find((task) => task.id === activeTaskId) || null;
  const draggedTask = filteredTasks.find((task) => task.id === draggedTaskId) || null;
  const selectedTasks = filteredTasks.filter((task) => selectedTaskIds.includes(task.id));
  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id));

  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((taskId) => filteredTasks.some((task) => task.id === taskId)));
    setActiveTaskId((current) => (filteredTasks.some((task) => task.id === current) ? current : ''));
  }, [filteredTasks]);

  useEffect(() => {
    if (!draggedTaskId || viewMode !== 'board') {
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
      setDraggedTaskId('');
      setDragOverColumn('');
    };

    const handlePointerUp = async (event) => {
      const nextStatus = getDropColumnFromPoint(event.clientX, event.clientY);
      const task = filteredTasks.find((item) => item.id === draggedTaskId);

      setDraggedTaskId('');
      setDragOverColumn('');

      if (nextStatus) {
        await handleMoveTaskToColumn(task, nextStatus);
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
  }, [draggedTaskId, filteredTasks, viewMode]);

  const handleTaskUpdate = async (taskId, payload, successMessage) => {
    const task = filteredTasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    setSavingTaskId(taskId);
    setError('');
    setBanner('');

    try {
      const result = await updateAuditTask(auditId, taskId, payload);
      onAuditTaskUpdated(result);

      if (successMessage) {
        setBanner(successMessage);
      }
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingTaskId('');
    }
  };

  const handleTaskVerify = async (taskId) => {
    setSavingTaskId(taskId);
    setError('');
    setBanner('');

    try {
      const result = await verifyAuditTask(auditId, taskId);
      onAuditReplaced(result.audit);
      setBanner(result.verified ? 'Issue rechecked and marked fixed.' : 'Issue rechecked. It is still present on the website.');
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setSavingTaskId('');
    }
  };

  const handleMoveTaskToColumn = async (task, nextStatus) => {
    if (!task || task.status === nextStatus) {
      return;
    }

    await handleTaskUpdate(task.id, { status: nextStatus }, `Moved "${task.title}" to ${getStatusLabel(nextStatus)}.`);
  };

  const handleVerifyOpen = async () => {
    setSavingTaskId('bulk');
    setError('');
    setBanner('');

    try {
      const result = await verifyOpenAuditTasks(auditId);
      onAuditReplaced(result.audit);
      setBanner(`Rechecked ${formatNumber(result.recheckedPages?.length || 0)} pages. ${formatNumber(result.verifiedCount || 0)} tasks are now fixed.`);
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setSavingTaskId('');
    }
  };

  const handleToggleSelect = (taskId) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((currentTaskId) => currentTaskId !== taskId) : [...current, taskId],
    );
  };

  const handleSelectVisible = () => {
    setSelectedTaskIds(filteredTasks.map((task) => task.id));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleBulkStatusChange = async (nextStatus) => {
    const tasksToUpdate = selectedTasks.filter((task) => task.status !== nextStatus);

    if (!tasksToUpdate.length) {
      return;
    }

    setSavingTaskId('bulk-selection');
    setError('');
    setBanner('');

    try {
      for (const task of tasksToUpdate) {
        const result = await updateAuditTask(auditId, task.id, { status: nextStatus });
        onAuditTaskUpdated(result);
      }

      setBanner(`Moved ${formatNumber(tasksToUpdate.length)} selected tasks to ${getStatusLabel(nextStatus)}.`);
    } catch (bulkError) {
      setError(bulkError.message);
    } finally {
      setSavingTaskId('');
    }
  };

  const handleVerifySelected = async () => {
    if (!selectedTasks.length) {
      return;
    }

    setSavingTaskId('bulk-selection');
    setError('');
    setBanner('');

    try {
      let latestAudit = null;
      let verifiedCount = 0;

      for (const task of selectedTasks) {
        const result = await verifyAuditTask(auditId, task.id);
        latestAudit = result.audit;
        if (result.verified) {
          verifiedCount += 1;
        }
      }

      if (latestAudit) {
        onAuditReplaced(latestAudit);
      }

      setBanner(`Rechecked ${formatNumber(selectedTasks.length)} selected tasks. ${formatNumber(verifiedCount)} are now fixed.`);
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setSavingTaskId('');
    }
  };

  const handlePointerStart = (event, taskId) => {
    if (viewMode !== 'board') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setDraggedTaskId(taskId);
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDragOverColumn('');
  };

  const renderTaskCard = (task) => {
    const sharedProps = {
      isSelected: selectedTaskIds.includes(task.id),
      onOpenDetails: setActiveTaskId,
      onPointerStart: handlePointerStart,
      onToggleSelect: handleToggleSelect,
      task,
    };

    return viewMode === 'board' ? (
      <BoardTaskCard
        key={task.id}
        {...sharedProps}
        isDragging={draggedTaskId === task.id}
      />
    ) : (
      <GridTaskCard key={task.id} {...sharedProps} />
    );
  };

  return (
    <>
      <section className="panel compact-panel">
        <div className="panel-header compact-header">
          <div>
            <p className="eyebrow">Task Queue</p>
            <h3>Issue backlog</h3>
          </div>
          <div className="button-row">
            <div className="task-summary-strip">
              <span className="summary-chip">Total {formatNumber(taskSummary?.total || 0)}</span>
              <span className="summary-chip">Open {formatNumber(taskSummary?.byStatus?.open || 0)}</span>
              <span className="summary-chip">Progress {formatNumber(taskSummary?.byStatus?.in_progress || 0)}</span>
              <span className="summary-chip">Done {formatNumber(taskSummary?.byStatus?.fixed || 0)}</span>
            </div>
            <button type="button" className="secondary-button compact-button" onClick={handleVerifyOpen} disabled={savingTaskId === 'bulk'}>
              Verify Open
            </button>
          </div>
        </div>

        {selectedTaskIds.length ? (
          <div className="bulk-action-bar">
            <div className="bulk-action-copy">
              <strong>{formatNumber(selectedTaskIds.length)} selected</strong>
              <span className="muted">{allVisibleSelected ? 'All visible cards are selected.' : 'Use bulk actions across the selected cards.'}</span>
            </div>
            <div className="bulk-action-controls">
              <button type="button" className="secondary-button compact-button" onClick={allVisibleSelected ? handleClearSelection : handleSelectVisible}>
                {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
              </button>
              <button type="button" className="secondary-button compact-button" onClick={() => handleBulkStatusChange('open')} disabled={savingTaskId === 'bulk-selection'}>
                Move to To Do
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => handleBulkStatusChange('in_progress')}
                disabled={savingTaskId === 'bulk-selection'}
              >
                Move to In Progress
              </button>
              <button type="button" className="secondary-button compact-button" onClick={() => handleBulkStatusChange('fixed')} disabled={savingTaskId === 'bulk-selection'}>
                Move to Done
              </button>
              <button type="button" className="secondary-button compact-button" onClick={handleVerifySelected} disabled={savingTaskId === 'bulk-selection'}>
                Recheck Selected
              </button>
              <button type="button" className="secondary-button compact-button" onClick={handleClearSelection}>
                Clear Selection
              </button>
            </div>
          </div>
        ) : null}

        {banner ? <p className="success-text compact-message">{banner}</p> : null}
        {error ? <p className="error-text compact-message">{error}</p> : null}

        {filteredTasks.length === 0 ? <p className="muted">No tasks match the current filters.</p> : null}

        {viewMode === 'board' ? (
          <section className="board-scroll">
            <div className="board-layout compact-board-layout">
              {boardColumns.map((column) => (
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
                    {column.items.length === 0 ? <p className="muted">No tasks here.</p> : null}
                    {column.items.map((task) => renderTaskCard(task))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : viewMode === 'list' ? (
          <ListTaskTable
            filteredTasks={filteredTasks}
            onOpenDetails={setActiveTaskId}
            onToggleSelect={handleToggleSelect}
            savingTaskId={savingTaskId}
            selectedTaskIds={selectedTaskIds}
          />
        ) : (
          <section className={viewMode === 'list' ? 'compact-list' : 'compact-grid'}>
            {filteredTasks.map((task) => renderTaskCard(task))}
          </section>
        )}
      </section>

      {draggedTask && viewMode === 'board' ? (
        <div
          className="drag-preview"
          style={{
            left: `${dragPosition.x + 14}px`,
            top: `${dragPosition.y + 14}px`,
          }}
        >
          <span className="board-label">{draggedTask.category}</span>
          <strong>{draggedTask.title}</strong>
        </div>
      ) : null}

      {activeTask ? (
        <DetailModal subtitle="Task details" title={activeTask.title} onClose={() => setActiveTaskId('')}>
          <TaskDetailsPanel
            key={`${activeTask.id}-${activeTask.updatedAt}`}
            onTaskUpdate={handleTaskUpdate}
            onTaskVerify={handleTaskVerify}
            savingTaskId={savingTaskId}
            task={activeTask}
          />
        </DetailModal>
      ) : null}
    </>
  );
}

export default TaskBoard;
