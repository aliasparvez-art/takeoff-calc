import React, { useState, useEffect } from 'react';

const EditMarkPopover = ({ mark, onClose, onSave, onDelete }) => {
  const [label, setLabel] = useState(mark.label || '');
  useEffect(() => { setLabel(mark.label || ''); }, [mark]);

  return (
    <div
      className="absolute top-16 right-4 bg-qto-surface border border-qto-primary rounded-qto p-4 shadow-2xl z-30 w-72"
      data-testid="edit-mark-popover"
    >
      <div className="text-xs font-mono text-qto-primary mb-2">
        Edit {mark.ref_id} @ ({Math.round(mark.position_x)}, {Math.round(mark.position_y)})
      </div>
      <div className="mb-3">
        <label className="qto-label">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(label);
            if (e.key === 'Escape') onClose();
          }}
          placeholder="e.g. Column base pad"
          className="qto-input w-full text-xs"
          data-testid="edit-mark-label"
          autoFocus
        />
      </div>
      <div className="flex gap-2 mb-2">
        <button onClick={onClose} className="qto-btn-secondary text-xs flex-1" data-testid="cancel-edit-mark">
          Cancel
        </button>
        <button onClick={() => onSave(label)} className="qto-btn text-xs flex-1" data-testid="save-edit-mark">
          Save
        </button>
      </div>
      <button
        onClick={() => { if (window.confirm(`Delete ${mark.ref_id}?`)) onDelete(); }}
        className="w-full text-xs px-2 py-1.5 text-red-400 hover:bg-red-500/10 rounded transition-qto border border-red-500/30"
        data-testid="delete-mark-from-popover"
      >
        Delete Mark
      </button>
    </div>
  );
};

export default EditMarkPopover;
