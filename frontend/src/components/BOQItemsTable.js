import React, { useState, useRef } from 'react';
import { Plus, Trash2, Upload, Download, FileText, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import logger from '../lib/logger';

const UNIT_OPTIONS = ['m', 'm²', 'm³', 'nr', 'kg', 't', 'hrs', 'l/s', 'ls'];

const fmt = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const BOQItemsTable = ({ projectId, items, onRefresh }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileInputRef = useRef(null);

  const grandTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);

  const handleAdd = async () => {
    try {
      await api.post(`/projects/${projectId}/boq-items`, {
        item_no: '',
        description: '',
        unit: 'm',
        quantity: 0,
        rate: 0,
      });
      onRefresh();
    } catch (e) { logger.error('Add BOQ item failed:', e); }
  };

  const handleUpdate = async (itemId, data) => {
    try {
      await api.put(`/projects/${projectId}/boq-items/${itemId}`, data);
      onRefresh();
    } catch (e) { logger.error('Update BOQ item failed:', e); }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this BOQ item?')) return;
    try {
      await api.delete(`/projects/${projectId}/boq-items/${itemId}`);
      onRefresh();
    } catch (e) { logger.error('Delete BOQ item failed:', e); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/projects/${projectId}/boq-items/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadMsg({ type: 'success', text: res.data.message });
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed';
      setUploadMsg({ type: 'error', text: msg });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Item No', 'Description', 'Unit', 'Quantity', 'Rate (Rs)', 'Amount (Rs)'];
    const rows = items.map((i) => [
      i.item_no, i.description, i.unit, i.quantity, i.rate,
      (i.quantity * i.rate).toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'BOQ.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="qto-panel p-4" data-testid="boq-items-table">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
          Bill of Quantities
        </h3>
        <div className="flex items-center gap-2">
          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            onChange={handleUpload}
            className="hidden"
            data-testid="boq-upload-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="qto-btn-secondary flex items-center gap-2 text-xs"
            data-testid="upload-boq-btn"
            title="Upload BOQ from Excel (.xlsx) or PDF"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Importing…' : 'Upload BOQ'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="qto-btn-secondary flex items-center gap-2 text-xs"
            data-testid="export-boq-csv"
            title="Export BOQ as CSV"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleAdd}
            className="qto-btn flex items-center gap-2"
            data-testid="add-boq-item-btn"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Upload message */}
      {uploadMsg && (
        <div className={`flex items-center gap-2 mb-3 p-2 rounded-qto text-sm ${
          uploadMsg.type === 'success'
            ? 'bg-green-500/15 text-green-300 border border-green-500/30'
            : 'bg-red-500/15 text-red-300 border border-red-500/30'
        }`} data-testid="upload-msg">
          {uploadMsg.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {uploadMsg.type === 'success' && <FileText className="w-4 h-4 flex-shrink-0" />}
          {uploadMsg.text}
          <button onClick={() => setUploadMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Upload hint */}
      <div className="mb-3 p-2 bg-qto-surface rounded-qto text-xs text-qto-text-secondary border border-qto-border">
        <span className="font-semibold text-qto-text-primary">Upload tip:</span> Your Excel/PDF BOQ should have columns:{' '}
        <span className="font-mono text-qto-primary">Item No, Description, Unit, Quantity, Rate</span>. The first row with these headers will be auto-detected.
      </div>

      <div className="overflow-x-auto">
        <table className="qto-table w-full">
          <thead>
            <tr>
              <th className="w-24">Item No</th>
              <th className="w-64">Description</th>
              <th className="w-20">Unit</th>
              <th className="w-28">Quantity</th>
              <th className="w-28">Rate (Rs)</th>
              <th className="w-28">Amount (Rs)</th>
              <th className="w-16">Del</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-qto-text-secondary">
                  No BOQ items yet. Click "Add Item" or "Upload BOQ" to populate.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <BOQItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(data) => handleUpdate(item.id, data)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-qto-surface font-bold">
                <td colSpan={5} className="text-right font-heading">GRAND TOTAL (Rs):</td>
                <td className="font-mono text-qto-primary text-right" data-testid="boq-grand-total">
                  {fmt(grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const BOQItemRow = ({ item, onUpdate, onDelete }) => {
  const [form, setForm] = useState(item);

  React.useEffect(() => { setForm(item); }, [item]);

  const save = () => {
    if (JSON.stringify(form) !== JSON.stringify(item)) onUpdate(form);
  };

  const amount = (parseFloat(form.quantity) || 0) * (parseFloat(form.rate) || 0);

  return (
    <tr data-testid={`boq-item-row-${item.id}`}>
      <td>
        <input
          type="text"
          value={form.item_no}
          onChange={(e) => setForm({ ...form, item_no: e.target.value })}
          onBlur={save}
          className="qto-input w-full"
          placeholder="1.1.1"
          data-testid={`boq-item-no-${item.id}`}
        />
      </td>
      <td>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          onBlur={save}
          className="qto-input w-full"
          placeholder="Item description"
          data-testid={`boq-item-desc-${item.id}`}
        />
      </td>
      <td>
        <select
          value={form.unit}
          onChange={(e) => { const upd = { ...form, unit: e.target.value }; setForm(upd); onUpdate(upd); }}
          className="qto-input w-full text-xs"
          data-testid={`boq-item-unit-${item.id}`}
        >
          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td>
        <input
          type="number"
          step="0.001"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
          onBlur={save}
          className="qto-input w-full font-mono"
          data-testid={`boq-item-qty-${item.id}`}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={form.rate}
          onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
          onBlur={save}
          className="qto-input w-full font-mono"
          data-testid={`boq-item-rate-${item.id}`}
        />
      </td>
      <td className="font-mono font-bold text-qto-primary text-right pr-2" data-testid={`boq-item-amount-${item.id}`}>
        {fmt(amount)}
      </td>
      <td>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-qto-surface-hover rounded-qto transition-qto"
          data-testid={`boq-item-delete-${item.id}`}
          title="Delete item"
        >
          <Trash2 className="w-4 h-4 text-qto-error" />
        </button>
      </td>
    </tr>
  );
};

export default BOQItemsTable;
