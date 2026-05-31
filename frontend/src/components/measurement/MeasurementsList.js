import React, { useState } from 'react';
import { Pencil, Check, X, Trash2 } from 'lucide-react';

const EditableValue = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const start = () => { setDraft(value); setEditing(true); };
  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0) onChange(v);
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          step="0.001"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="qto-input w-20 text-xs font-mono py-0.5"
          autoFocus
        />
        <button onClick={commit} className="p-0.5 hover:bg-qto-surface-active rounded" title="Accept">
          <Check className="w-3 h-3 text-qto-primary" />
        </button>
        <button onClick={cancel} className="p-0.5 hover:bg-qto-surface-active rounded" title="Cancel">
          <X className="w-3 h-3 text-qto-text-secondary" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      className="flex items-center gap-1 group"
      title="Click to edit value"
    >
      <span className="font-mono text-qto-primary font-bold">{value}</span>
      <Pencil className="w-2.5 h-2.5 text-qto-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

const MeasurementsList = ({ measurements, onUpdate, onDelete }) => (
  <div className="mb-4">
    <label className="qto-label">Captured ({measurements.length})</label>
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {measurements.map((m) => (
        <div key={m.id} className="p-2 bg-qto-bg rounded-qto text-xs group/item">
          <div className="flex justify-between items-center">
            <span className="text-qto-text-secondary capitalize">{m.type}</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <EditableValue
                  value={m.value}
                  onChange={(v) => {
                    if (m.type === 'linear' || m.type === 'polyline') {
                      onUpdate(m.id, { value: v.toFixed(3) });
                    } else if (m.type === 'rectangle') {
                      // treat edited value as area; keep ratio, update W × H
                      const ratio = parseFloat(m.dimensions?.width || 1) / parseFloat(m.dimensions?.height || 1);
                      const newH = Math.sqrt(v / ratio);
                      const newW = v / newH;
                      onUpdate(m.id, {
                        value: v.toFixed(3),
                        dimensions: { width: newW.toFixed(3), height: newH.toFixed(3) },
                      });
                    } else if (m.type === 'polygon') {
                      onUpdate(m.id, { value: v.toFixed(3) });
                    } else if (m.type === 'circle') {
                      const r = Math.sqrt(v / Math.PI);
                      onUpdate(m.id, {
                        value: v.toFixed(3),
                        dimensions: {
                          radius: r.toFixed(3),
                          diameter: (2 * r).toFixed(3),
                          circumference: (2 * Math.PI * r).toFixed(3),
                        },
                      });
                    }
                  }}
                />
                <span className="text-qto-text-secondary">{m.unit}</span>
              </div>
              <button
                onClick={() => onDelete && onDelete(m.id)}
                className="p-0.5 opacity-0 group-hover/item:opacity-100 hover:bg-red-500/20 rounded transition-opacity"
                title="Remove measurement"
                data-testid={`delete-measurement-${m.id}`}
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          </div>

          {m.type === 'rectangle' && m.dimensions && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-qto-text-secondary font-mono">W:</span>
              <EditableValue
                value={m.dimensions.width}
                onChange={(v) => {
                  const h = parseFloat(m.dimensions.height || 1);
                  onUpdate(m.id, {
                    value: (v * h).toFixed(3),
                    dimensions: { ...m.dimensions, width: v.toFixed(3) },
                  });
                }}
              />
              <span className="text-[10px] text-qto-text-secondary font-mono">m × H:</span>
              <EditableValue
                value={m.dimensions.height}
                onChange={(v) => {
                  const w = parseFloat(m.dimensions.width || 1);
                  onUpdate(m.id, {
                    value: (w * v).toFixed(3),
                    dimensions: { ...m.dimensions, height: v.toFixed(3) },
                  });
                }}
              />
              <span className="text-[10px] text-qto-text-secondary font-mono">m</span>
            </div>
          )}
          {m.type === 'polygon' && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              √area side: {Math.sqrt(parseFloat(m.value)).toFixed(3)} m
            </div>
          )}
          {m.type === 'circle' && m.dimensions && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[10px] text-qto-text-secondary font-mono">r:</span>
              <EditableValue
                value={m.dimensions.radius}
                onChange={(r) => {
                  onUpdate(m.id, {
                    value: (Math.PI * r * r).toFixed(3),
                    dimensions: {
                      radius: r.toFixed(3),
                      diameter: (2 * r).toFixed(3),
                      circumference: (2 * Math.PI * r).toFixed(3),
                    },
                  });
                }}
              />
              <span className="text-[10px] text-qto-text-secondary font-mono">m · Ø: {m.dimensions.diameter} m · C: {m.dimensions.circumference} m</span>
            </div>
          )}
          {m.type === 'polyline' && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              {m.points.length} pts along polyline
            </div>
          )}
        </div>
      ))}
      {measurements.length === 0 && <p className="text-xs text-qto-text-secondary">No measurements yet</p>}
    </div>
  </div>
);

export default MeasurementsList;
