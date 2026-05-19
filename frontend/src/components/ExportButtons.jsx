import { downloadFile, serializePagesToCsv, serializeTasksToCsv } from '../utils/formatData';

function ExportButtons({ activeTab, auditId, buttonClassName = 'secondary-button', items, mode = 'pages' }) {
  const safeTab = activeTab || 'all';

  const handleJsonExport = () => {
    downloadFile(
      `seo-audit-${auditId}-${safeTab}.json`,
      JSON.stringify(items, null, 2),
      'application/json',
    );
  };

  const handleCsvExport = () => {
    const csv = mode === 'tasks' ? serializeTasksToCsv(items) : serializePagesToCsv(items);
    downloadFile(`seo-audit-${auditId}-${safeTab}.csv`, csv, 'text/csv');
  };

  return (
    <div className="button-row">
      <button type="button" className={buttonClassName} onClick={handleCsvExport}>
        Export CSV
      </button>
      <button type="button" className={buttonClassName} onClick={handleJsonExport}>
        Export JSON
      </button>
    </div>
  );
}

export default ExportButtons;
