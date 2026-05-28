import React from 'react';

const MarkPopover = ({ position, row, markRowId, setMarkRowId, markLabel, setMarkLabel, onCancel, onSave }) => (
  <div
    className="absolute top-16 right-4 bg-qto-surface border border-qto-primary rounded-qto p-4 shadow-2xl z-30 w-72"
    data-testid="mark-popover"
  >
    <div className="text-xs font-mono text-qto-primary mb-2">
      Mark @ ({Math.round(position.x)}, {Math.round(position.y)})
    </div>
    <div className="mb-2">
      <label className="qto-label">Link to BOQ Row</label>
      <select value={markRowId} onChange={(e) => setMarkRowId(e.target.value)} className="qto-input w-full text-xs" data-testid="mark-row-select">
        <option value="">-- Optional --</option>
        {row && <option value={row.id}>{row.item_no} - {row.description}</option>}
      </select>
    </div>
    <div className="mb-3">
      <label className="qto-label">Label</label>
      <input
        type="text"
        value={markLabel}
        onChange={(e) => setMarkLabel(e.target.value)}
        placeholder="e.g. Column base pad"
        className="qto-input w-full text-xs"
        data-testid="mark-label"
        autoFocus
      />
    </div>
    <div className="flex gap-2">
      <button onClick={onCancel} className="qto-btn-secondary text-xs flex-1" data-testid="cancel-mark">Cancel</button>
      <button onClick={onSave} className="qto-btn text-xs flex-1" data-testid="save-mark">Save Mark</button>
    </div>
  </div>
);

export default MarkPopover;
