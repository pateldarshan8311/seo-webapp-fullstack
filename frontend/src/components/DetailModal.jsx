import { useEffect } from 'react';

function DetailModal({ actions, children, onClose, subtitle = 'Card details', title }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label={title}
        aria-modal="true"
        className="modal-shell"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div className="modal-heading">
            <p className="eyebrow">{subtitle}</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-content">{children}</div>

        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export default DetailModal;
