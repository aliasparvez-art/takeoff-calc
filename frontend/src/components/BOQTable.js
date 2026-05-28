import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import logger from '../lib/logger';
import { Plus, Trash2, Copy, Ruler, Pencil } from 'lucide-react';
import DrawingMeasurement from './DrawingMeasurement';

const UNIT_OPTIONS = ['m', 'm²', 'm³', 'nr', 'kg', 't', 'hrs', 'l/s', 'ls'];

// Compute Qty client-side mirroring backend formula (Enhancement 4).
const computeQty = (row) => {
  const n = parseFloat(row.nos) || 0;
  const l = parseFloat(row.length) || 0;
  const b = parseFloat(row.breadth) || 0;
  const d = parseFloat(row.depth) || 0;
  if (!(n || l || b || d)) return null;
  const nv = n || 1, lv = l || 1, bv = b || 1, dv = d || 1;
  return nv * lv * bv * dv;
};

const formatQty = (qty) => (qty == null ? '—' : qty.toFixed(3));

const BOQTable = ({ projectId, rows, onRefresh, drawings, marks = [], onMarksUpdate, pendingOpenMark, onPendingOpenMarkConsumed }) => {
  const [showMeasurement, setShowMeasurement] = useState(null);
  const [loading, setLoading] = useState(false);

  // React to a "open mark" request from the References tab.
  useEffect(() => {
    if (pendingOpenMark) {
      setShowMeasurement({
        rowId: pendingOpenMark.boq_row_id || null,
        focusMarkId: pendingOpenMark.id,
        drawingId: pendingOpenMark.drawing_id,
      });
      onPendingOpenMarkConsumed && onPendingOpenMarkConsumed();
    }
  }, [pendingOpenMark, onPendingOpenMarkConsumed]);

  const defaultRow = {
    item_no: '', description: '', location: '', drawing_ref: '',
    spec_ref: '', remarks: '', nos: 1, length: 0, breadth: 0,
    depth: 0, unit: 'm', is_deduction: false,
  };

  const handleAddRow = async () => {
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/boq-rows`, defaultRow);
      onRefresh();
    } catch (e) { logger.error('Add row failed:', e); }
    finally { setLoading(false); }
  };

  const handleUpdateRow = async (rowId, data) => {
    try {
      await api.put(`/projects/${projectId}/boq-rows/${rowId}`, data);
      onRefresh();
    } catch (e) { logger.error('Update row failed:', e); }
  };

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm('Delete this BOQ row?')) return;
    try {
      await api.delete(`/projects/${projectId}/boq-rows/${rowId}`);
      onRefresh();
    } catch (e) { logger.error('Delete row failed:', e); }
  };

  const handleDuplicateRow = async (row) => {
    const dup = { ...row, item_no: row.item_no + ' (Copy)' };
    delete dup.id; delete dup.project_id; delete dup.order; delete dup.created_at; delete dup.quantity;
    try {
      await api.post(`/projects/${projectId}/boq-rows`, dup);
      onRefresh();
    } catch (e) { logger.error('Duplicate row failed:', e); }
  };

  const subtotal = rows.reduce((s, r) => {
    const q = computeQty(r) || 0;
    return r.is_deduction ? s - q : s + q;
  }, 0);

  // Build mark badges per row
  const marksByRow = {};
  marks.forEach((m) => {
    if (!m.boq_row_id) return;
    if (!marksByRow[m.boq_row_id]) marksByRow[m.boq_row_id] = [];
    marksByRow[m.boq_row_id].push(m);
  });

  return (
    <div className="qto-panel p-4" data-testid="boq-table-container">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
          Bill of Quantities Take-Off Sheet
        </h3>
        <button onClick={handleAddRow} disabled={loading} className="qto-btn flex items-center gap-2" data-testid="add-boq-row-button">
          <Plus className="w-4 h-4" /> Add Row
        </button>
      </div>

      <div className="w-full">
        <table className="qto-table w-full">
          <thead>
            <tr>
              <th className="w-20">Item No</th>
              <th className="w-44">Description</th>
              <th className="w-16">Unit</th>
              <th className="w-28">Location</th>
              <th className="w-28">Drawing Ref</th>
              <th className="w-24">Spec Ref</th>
              <th className="w-16">NOS</th>
              <th className="w-20">L</th>
              <th className="w-20">B</th>
              <th className="w-20">D/H</th>
              <th className="w-28">Qty (calc.)</th>
              <th className="w-16">Deduct</th>
              <th className="w-52">Remarks</th>
              <th className="w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="14" className="text-center py-8 text-qto-text-secondary">No BOQ rows yet. Click "Add Row" to start.</td></tr>
            ) : rows.map((row) => (
              <BOQRow
                key={row.id}
                row={row}
                rowMarks={marksByRow[row.id] || []}
                allMarks={marks}
                drawings={drawings}
                onUpdate={(data) => handleUpdateRow(row.id, data)}
                onDelete={() => handleDeleteRow(row.id)}
                onDuplicate={() => handleDuplicateRow(row)}
                onMeasureField={(field) => setShowMeasurement({ rowId: row.id, field })}
                onOpenRef={(mark) => setShowMeasurement({ rowId: row.id, focusMarkId: mark.id, drawingId: mark.drawing_id })}
              />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-qto-surface font-bold">
                <td colSpan="10" className="text-right">TOTAL:</td>
                <td className="font-mono text-qto-primary">{subtotal.toFixed(3)}</td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showMeasurement && (
        <DrawingMeasurement
          projectId={projectId}
          row={rows.find((r) => r.id === showMeasurement.rowId)}
          drawings={drawings}
          marks={marks}
          targetField={showMeasurement.field}
          focusMarkId={showMeasurement.focusMarkId}
          initialDrawingId={showMeasurement.drawingId}
          onClose={() => setShowMeasurement(null)}
          onMarksUpdate={onMarksUpdate}
          onSendToField={(field, value, drawing) => {
            const row = rows.find((r) => r.id === showMeasurement.rowId);
            if (!row) { setShowMeasurement(null); return; }
            const update = {
              ...row,
              drawing_ref: drawing?.filename || row.drawing_ref,
            };
            // `field` can be 'length' | 'breadth' | 'depth', or 'length+breadth' for rectangle send
            if (field === 'length+breadth') {
              // value is { length, breadth }
              update.length = value.length;
              update.breadth = value.breadth;
            } else {
              update[field] = value;
            }
            // Track source so we can show "measured from" badge.
            const measMeta = row.measurement_meta || {};
            const src = drawing ? `${drawing.filename} pg.1` : 'manual';
            if (field === 'length+breadth') {
              measMeta.length = src;
              measMeta.breadth = src;
            } else {
              measMeta[field] = src;
            }
            update.measurement_meta = measMeta;
            handleUpdateRow(showMeasurement.rowId, update);
            setShowMeasurement(null);
          }}
          onMarkSaved={(mark, rowId) => {
            // Append ref badge to row Remarks
            const row = rows.find((r) => r.id === rowId);
            if (row) {
              const dwg = drawings.find((d) => d.id === mark.drawing_id);
              const tag = `[${mark.ref_id} | ${dwg?.filename || ''} pg.${mark.page}]`;
              const newRemarks = row.remarks ? `${row.remarks} ${tag}` : tag;
              handleUpdateRow(rowId, { ...row, remarks: newRemarks });
            }
            onMarksUpdate && onMarksUpdate();
          }}
        />
      )}
    </div>
  );
};

const FieldWithMeasure = ({ value, onChange, onBlur, onMeasure, testid, measured }) => (
  <div className="relative flex items-center gap-1">
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      className="qto-input w-full font-mono pr-6"
      data-testid={testid}
    />
    <button
      type="button"
      onClick={onMeasure}
      className="absolute right-1 p-0.5 hover:bg-qto-surface-active rounded transition-qto"
      title="Measure from drawing"
      data-testid={`${testid}-measure`}
    >
      <Ruler className={`w-3.5 h-3.5 ${measured ? 'text-qto-success' : 'text-qto-text-secondary'}`} />
    </button>
  </div>
);

const BOQRow = ({ row, rowMarks, allMarks = [], drawings, onUpdate, onDelete, onDuplicate, onMeasureField, onOpenRef }) => {
  const [formData, setFormData] = useState(row);
  const meta = row.measurement_meta || {};

  // Sync local state when the row prop changes (e.g., after a measurement is
  // sent from the drawing modal and the parent refetches).
  React.useEffect(() => {
    setFormData(row);
  }, [row]);

  const handleBlur = () => {
    if (JSON.stringify(formData) !== JSON.stringify(row)) onUpdate(formData);
  };

  const qty = computeQty(formData);
  const displayQty = formatQty(qty);
  const signedQty = qty != null && formData.is_deduction ? -qty : qty;

  // Render Remarks with parseable ref badges
  const renderRemarks = () => {
    const text = formData.remarks || '';
    const parts = text.split(/(\[REF-\d{3}[^\]]*\])/g);
    return (
      <div className="flex flex-wrap items-center gap-1">
        {parts.map((p, i) => {
          const m = p.match(/^\[(REF-\d{3})/);
          if (m) {
            const mark = rowMarks.find((x) => x.ref_id === m[1]) || allMarks.find((x) => x.ref_id === m[1]);
            const isOrphan = !mark;
            return (
              <button
                key={i}
                type="button"
                disabled={isOrphan}
                title={isOrphan ? 'Reference mark no longer exists (deleted)' : 'Open on drawing'}
                onClick={(e) => { e.stopPropagation(); if (mark) onOpenRef(mark); }}
                className={`text-xs font-mono px-1.5 py-0.5 rounded transition-qto ${
                  isOrphan
                    ? 'bg-red-500/15 text-red-300 line-through cursor-not-allowed'
                    : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 cursor-pointer'
                }`}
                data-testid={`ref-badge-${m[1]}`}
              >
                {p}
              </button>
            );
          }
          return p ? (
            <input
              key={i}
              type="text"
              value={p}
              onChange={(e) => {
                const newText = parts.map((pp, ii) => (ii === i ? e.target.value : pp)).join('');
                setFormData({ ...formData, remarks: newText });
              }}
              onBlur={handleBlur}
              className="qto-input flex-1 text-xs"
              data-testid={`remarks-${row.id}`}
            />
          ) : null;
        })}
        {parts.every((p) => !p || /^\[REF-/.test(p)) && (
          <input
            type="text"
            value=""
            onChange={(e) => {
              setFormData({ ...formData, remarks: (formData.remarks || '') + e.target.value });
            }}
            onBlur={handleBlur}
            placeholder="Add note..."
            className="qto-input flex-1 text-xs min-w-[80px]"
            data-testid={`remarks-${row.id}-add`}
          />
        )}
      </div>
    );
  };

  return (
    <tr className={row.is_deduction ? 'bg-qto-error/10' : ''} data-testid={`boq-row-${row.id}`}>
      <td>
        <input type="text" value={formData.item_no}
          onChange={(e) => setFormData({ ...formData, item_no: e.target.value })}
          onBlur={handleBlur} className="qto-input w-full" data-testid={`item-no-${row.id}`} />
      </td>
      <td>
        <input type="text" value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          onBlur={handleBlur} className="qto-input w-full" data-testid={`description-${row.id}`} />
      </td>
      <td>
        <select value={formData.unit}
          onChange={(e) => { setFormData({ ...formData, unit: e.target.value }); onUpdate({ ...formData, unit: e.target.value }); }}
          className="qto-input w-full text-xs" data-testid={`unit-${row.id}`}>
          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td>
        <input type="text" value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          onBlur={handleBlur} className="qto-input w-full" data-testid={`location-${row.id}`} />
      </td>
      <td>
        <input type="text" value={formData.drawing_ref}
          onChange={(e) => setFormData({ ...formData, drawing_ref: e.target.value })}
          onBlur={handleBlur} className="qto-input w-full" data-testid={`drawing-ref-${row.id}`} />
      </td>
      <td>
        <input type="text" value={formData.spec_ref}
          onChange={(e) => setFormData({ ...formData, spec_ref: e.target.value })}
          onBlur={handleBlur} className="qto-input w-full" data-testid={`spec-ref-${row.id}`} />
      </td>
      <td title="Number of times — enter manually">
        <input type="number" step="0.01" value={formData.nos}
          onChange={(e) => setFormData({ ...formData, nos: parseFloat(e.target.value) || 0 })}
          onBlur={handleBlur} className="qto-input w-full font-mono" data-testid={`nos-${row.id}`} />
      </td>
      <td title={meta.length ? `Measured from ${meta.length}` : ''}>
        <FieldWithMeasure
          value={formData.length}
          onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })}
          onBlur={handleBlur}
          onMeasure={() => onMeasureField('length')}
          testid={`length-${row.id}`}
          measured={!!meta.length && meta.length !== 'manual'}
        />
      </td>
      <td title={meta.breadth ? `Measured from ${meta.breadth}` : ''}>
        <FieldWithMeasure
          value={formData.breadth}
          onChange={(e) => setFormData({ ...formData, breadth: parseFloat(e.target.value) || 0 })}
          onBlur={handleBlur}
          onMeasure={() => onMeasureField('breadth')}
          testid={`breadth-${row.id}`}
          measured={!!meta.breadth && meta.breadth !== 'manual'}
        />
      </td>
      <td title={meta.depth ? `Measured from ${meta.depth}` : ''}>
        <FieldWithMeasure
          value={formData.depth}
          onChange={(e) => setFormData({ ...formData, depth: parseFloat(e.target.value) || 0 })}
          onBlur={handleBlur}
          onMeasure={() => onMeasureField('depth')}
          testid={`depth-${row.id}`}
          measured={!!meta.depth && meta.depth !== 'manual'}
        />
      </td>
      <td className="font-mono font-bold" data-testid={`quantity-${row.id}`}>
        <div className="flex items-center justify-between gap-1">
          <span className={signedQty != null && signedQty < 0 ? 'text-qto-error' : 'text-qto-primary'}>
            {qty == null ? '—' : (signedQty < 0 ? `-${(-signedQty).toFixed(3)}` : signedQty.toFixed(3))}
          </span>
          <span className="text-[10px] bg-qto-primary/20 text-qto-primary px-1.5 py-0.5 rounded font-mono">
            {formData.unit}
          </span>
        </div>
      </td>
      <td className="text-center">
        <input type="checkbox" checked={formData.is_deduction}
          onChange={(e) => { setFormData({ ...formData, is_deduction: e.target.checked }); onUpdate({ ...formData, is_deduction: e.target.checked }); }}
          className="w-4 h-4 accent-qto-error" data-testid={`deduction-${row.id}`} />
      </td>
      <td>{renderRemarks()}</td>
      <td>
        <div className="flex gap-1">
          <button onClick={() => onMeasureField('mark')} className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto" title="Add reference mark" data-testid={`mark-${row.id}`}>
            <Pencil className="w-4 h-4 text-cyan-400" />
          </button>
          <button onClick={onDuplicate} className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto" title="Duplicate row" data-testid={`duplicate-${row.id}`}>
            <Copy className="w-4 h-4 text-qto-text-secondary" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto" title="Delete row" data-testid={`delete-${row.id}`}>
            <Trash2 className="w-4 h-4 text-qto-error" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export { computeQty, formatQty, UNIT_OPTIONS };
export default BOQTable;
