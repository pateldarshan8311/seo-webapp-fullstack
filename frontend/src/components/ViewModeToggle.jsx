function ViewModeToggle({ options = [], value, onChange }) {
  return (
    <div className="view-toggle" role="tablist" aria-label="View mode">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`view-toggle-button ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default ViewModeToggle;
