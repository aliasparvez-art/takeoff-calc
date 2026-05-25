import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Copy, Ruler } from 'lucide-react';
import DrawingMeasurement from './DrawingMeasurement';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BOQTable = ({ projectId, rows, onRefresh, drawings }) => {
  const [editingRow, setEditingRow] = useState(null);
  const [showMeasurement, setShowMeasurement] = useState(null);
  const [loading, setLoading] = useState(false);

  const defaultRow = {
    item_no: '',
    description: '',
    location: '',
    drawing_ref: '',
    spec_ref: '',
    remarks: '',
    nos: 1,
    length: 0,
    breadth: 0,
    depth: 0,
    unit: 'm',
    is_deduction: false,
  };

  const handleAddRow = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/projects/${projectId}/boq-rows`, defaultRow, {
        withCredentials: true,
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding row:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRow = async (rowId, data) => {
    try {
      await axios.put(`${API}/projects/${projectId}/boq-rows/${rowId}`, data, {
        withCredentials: true,
      });
      onRefresh();
      setEditingRow(null);
    } catch (error) {
      console.error('Error updating row:', error);
    }
  };

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm('Delete this BOQ row?')) return;
    
    try {
      await axios.delete(`${API}/projects/${projectId}/boq-rows/${rowId}`, {
        withCredentials: true,
      });
      onRefresh();
    } catch (error) {
      console.error('Error deleting row:', error);
    }
  };

  const handleDuplicateRow = async (row) => {
    const duplicateData = {
      ...row,
      item_no: row.item_no + ' (Copy)',
    };
    delete duplicateData.id;
    delete duplicateData.project_id;
    delete duplicateData.order;
    delete duplicateData.created_at;

    try {
      await axios.post(`${API}/projects/${projectId}/boq-rows`, duplicateData, {
        withCredentials: true,
      });
      onRefresh();
    } catch (error) {
      console.error('Error duplicating row:', error);
    }
  };

  const calculateSubtotal = () => {
    return rows.reduce((sum, row) => {
      if (row.is_deduction) {
        return sum - row.quantity;
      }
      return sum + row.quantity;
    }, 0);
  };

  return (
    <div className="qto-panel p-4" data-testid="boq-table-container">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
          Bill of Quantities Take-Off Sheet
        </h3>
        <button
          onClick={handleAddRow}
          disabled={loading}
          className="qto-btn flex items-center gap-2"
          data-testid="add-boq-row-button"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="qto-table w-full">
          <thead>
            <tr>
              <th className="w-24">Item No</th>
              <th className="w-48">Description</th>
              <th className="w-32">Location</th>
              <th className="w-32">Drawing Ref</th>
              <th className="w-32">Spec Ref</th>
              <th className="w-20">Nos</th>
              <th className="w-20">L (m)</th>
              <th className="w-20">B (m)</th>
              <th className="w-20">D/H (m)</th>
              <th className="w-20">Unit</th>
              <th className="w-24">Quantity</th>
              <th className="w-20">Deduct</th>
              <th className="w-48">Remarks</th>
              <th className="w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="14" className="text-center py-8 text-qto-text-secondary">
                  No BOQ rows yet. Click "Add Row" to start.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <BOQRow
                  key={row.id}
                  row={row}
                  isEditing={editingRow === row.id}
                  onEdit={() => setEditingRow(row.id)}
                  onUpdate={(data) => handleUpdateRow(row.id, data)}
                  onDelete={() => handleDeleteRow(row.id)}
                  onDuplicate={() => handleDuplicateRow(row)}
                  onMeasure={() => setShowMeasurement(row.id)}
                />
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-qto-surface font-bold">
                <td colSpan="10" className="text-right">TOTAL:</td>
                <td className="font-mono">{calculateSubtotal().toFixed(3)}</td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showMeasurement && (
        <DrawingMeasurement
          rowId={showMeasurement}
          row={rows.find(r => r.id === showMeasurement)}
          drawings={drawings}
          onClose={() => setShowMeasurement(null)}
          onUpdate={(data) => {
            const row = rows.find(r => r.id === showMeasurement);
            handleUpdateRow(showMeasurement, { ...row, ...data });
            setShowMeasurement(null);
          }}
        />
      )}
    </div>
  );
};

const BOQRow = ({ row, isEditing, onEdit, onUpdate, onDelete, onDuplicate, onMeasure }) => {
  const [formData, setFormData] = useState(row);

  const handleBlur = () => {
    if (JSON.stringify(formData) !== JSON.stringify(row)) {
      onUpdate(formData);
    }
  };

  return (
    <tr className={row.is_deduction ? 'bg-qto-error/10' : ''} data-testid={`boq-row-${row.id}`}>
      <td>
        <input
          type="text"
          value={formData.item_no}
          onChange={(e) => setFormData({ ...formData, item_no: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`item-no-${row.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`description-${row.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`location-${row.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={formData.drawing_ref}
          onChange={(e) => setFormData({ ...formData, drawing_ref: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`drawing-ref-${row.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={formData.spec_ref}
          onChange={(e) => setFormData({ ...formData, spec_ref: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`spec-ref-${row.id}`}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={formData.nos}
          onChange={(e) => setFormData({ ...formData, nos: parseFloat(e.target.value) || 0 })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full font-mono"
          data-testid={`nos-${row.id}`}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={formData.length}
          onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full font-mono"
          data-testid={`length-${row.id}`}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={formData.breadth}
          onChange={(e) => setFormData({ ...formData, breadth: parseFloat(e.target.value) || 0 })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full font-mono"
          data-testid={`breadth-${row.id}`}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={formData.depth}
          onChange={(e) => setFormData({ ...formData, depth: parseFloat(e.target.value) || 0 })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full font-mono"
          data-testid={`depth-${row.id}`}
        />
      </td>
      <td>
        <select
          value={formData.unit}
          onChange={(e) => {
            setFormData({ ...formData, unit: e.target.value });
            onEdit();
          }}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`unit-${row.id}`}
        >
          <option value="m">m</option>
          <option value="m²">m²</option>
          <option value="m³">m³</option>
          <option value="nr">nr</option>
          <option value="kg">kg</option>
          <option value="t">t</option>
          <option value="ls">ls</option>
        </select>
      </td>
      <td className="font-mono font-bold text-qto-primary" data-testid={`quantity-${row.id}`}>
        {row.quantity.toFixed(3)}
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={formData.is_deduction}
          onChange={(e) => {
            setFormData({ ...formData, is_deduction: e.target.checked });
            onUpdate({ ...formData, is_deduction: e.target.checked });
          }}
          className="w-4 h-4 accent-qto-error"
          data-testid={`deduction-${row.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={formData.remarks}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          onFocus={onEdit}
          onBlur={handleBlur}
          className="qto-input w-full"
          data-testid={`remarks-${row.id}`}
        />
      </td>
      <td>
        <div className="flex gap-1">
          <button
            onClick={onMeasure}
            className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto"
            title="Measure from drawing"
            data-testid={`measure-${row.id}`}
          >
            <Ruler className="w-4 h-4 text-qto-primary" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto"
            title="Duplicate row"
            data-testid={`duplicate-${row.id}`}
          >
            <Copy className="w-4 h-4 text-qto-text-secondary" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto"
            title="Delete row"
            data-testid={`delete-${row.id}`}
          >
            <Trash2 className="w-4 h-4 text-qto-error" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default BOQTable;
