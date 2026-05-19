import { useState } from 'react';

function ExpandableList({
  emptyLabel = 'None',
  items = [],
  limit = 3,
  renderItem,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!items.length) {
    return <span className="muted">{emptyLabel}</span>;
  }

  const visibleItems = isExpanded ? items : items.slice(0, limit);

  return (
    <div className="stack-list">
      {visibleItems.map((item, index) => renderItem(item, index))}
      {items.length > limit ? (
        <button type="button" className="inline-button" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Show less' : `+${items.length - limit} more`}
        </button>
      ) : null}
    </div>
  );
}

export default ExpandableList;

