import { PAGE_STATUS_OPTIONS, TAB_OPTIONS, TASK_DATE_OPTIONS, TASK_STATUS_OPTIONS } from '../utils/formatData';
import ViewModeToggle from './ViewModeToggle';

function Filters({
  activeTab,
  categoryFilter,
  categoryOptions = [],
  counts,
  dateFilter,
  onCategoryFilterChange,
  onDateFilterChange,
  onSearchChange,
  onStatusFilterChange,
  onTabChange,
  onViewModeChange,
  searchTerm,
  statusFilter,
  viewMode,
  viewModes = [],
}) {
  const isTaskView = activeTab === 'tasks';
  const statusOptions = isTaskView ? TASK_STATUS_OPTIONS : PAGE_STATUS_OPTIONS;

  return (
    <section className="panel compact-panel board-filters">
      <div className="tab-row">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
            <span>{counts[tab.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="filter-row">
        <div className="field compact">
          <span>View mode</span>
          <ViewModeToggle options={viewModes} value={viewMode} onChange={onViewModeChange} />
        </div>

        <label className="field grow">
          <span>{isTaskView ? 'Search tasks' : 'Search URLs or metadata'}</span>
          <input
            type="search"
            placeholder={isTaskView ? 'Search task title, issue, category, URL...' : 'Search title, description, H1, URL...'}
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label className="field compact">
          <span>Status filter</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {isTaskView ? (
          <label className="field compact">
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isTaskView ? (
          <label className="field compact">
            <span>Date filter</span>
            <select value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)}>
              {TASK_DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}

export default Filters;
