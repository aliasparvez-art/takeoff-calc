import React, { useState } from 'react';
import { ExternalLink, Trash2, Pencil, Check, X, Printer, FileText } from 'lucide-react';
import api from '../lib/api';
import logger from '../lib/logger';
import { generateFullReport } from '../lib/pdfReport';

const ReferencesPanel = ({ projectId, projectName, marks, drawings, boqRows, onOpenMark, onMarksUpdate }) => {
  const [editingId, setEditingId] = useState(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const startEdit = (mark) => {
    setEditingId(mark.id);
    setDraftLabel(mark.label || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel('');
  };

  const saveEdit = async (mark) => {
    try {
      await api.patch(`/projects/${projectId}/marks/${mark.id}`, { label: draftLabel });
      onMarksUpdate && onMarksUpdate();
    } catch (e) { logger.error('Update mark label failed:', e); }
    finally { cancelEdit(); }
  };

  const handleDelete = async (mark) => {
    if (!window.confirm(`Delete ${mark.ref_id}?`)) return;
    try {
      await api.delete(`/projects/${projectId}/marks/${mark.id}`);
      onMarksUpdate && onMarksUpdate();
    } catch (e) { logger.error('Delete mark failed:', e); }
  };

  const handlePrint = () => {
    document.body.classList.add('qto-print-refs');
    window.print();
    setTimeout(() => document.body.classList.remove('qto-print-refs'), 500);
  };

  const handleExportFullReport = async () => {
    setExportingPdf(true);
    try {
      await generateFullReport({ projectName, drawings, marks, boqRows });
    } catch (e) {
      logger.error('Export full report failed:', e);
      window.alert('Export failed. See console for details.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (marks.length === 0) {
    return (
      <div className="qto-panel p-12 text-center" data-testid="references-empty">
        <p className="text-qto-text-secondary mb-2">No reference marks yet</p>
        <p className="text-xs text-qto-text-secondary">
          Place reference marks on drawings from the BOQ table or drawing viewer to build a cross-reference index.
        </p>
      </div>
    );
  }

  return (
    <div className="qto-panel p-4 qto-references-print" data-testid="references-panel">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
          Drawing Reference Index
        </h3>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExportFullReport} disabled={exportingPdf || drawings.length === 0} className="qto-btn flex items-center gap-2 text-xs" data-testid="export-full-report" title="Export drawings + index as a single PDF">
            <FileText className="w-4 h-4" /> {exportingPdf ? 'Building PDF…' : 'Export Full Report'}
          </button>
          <button onClick={handlePrint} className="qto-btn-secondary flex items-center gap-2 text-xs" data-testid="print-references">
            <Printer className="w-4 h-4" /> Print Index
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="qto-table w-full">
          <thead>
            <tr>
              <th className="w-24">Ref ID</th>
              <th className="w-48">Drawing + Page</th>
              <th className="w-24">BOQ Item No.</th>
              <th className="w-64">Description</th>
              <th className="w-56">Label / Note</th>
              <th className="w-24 no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((mark) => {
              const drawing = drawings.find((d) => d.id === mark.drawing_id);
              const row = boqRows.find((r) => r.id === mark.boq_row_id);
              const isEditing = editingId === mark.id;
              return (
                <tr key={mark.id} data-testid={`ref-row-${mark.ref_id}`}>
                  <td className="font-mono text-qto-primary font-bold">{mark.ref_id}</td>
                  <td className="font-mono text-xs">{drawing?.filename || '—'} pg.{mark.page}</td>
                  <td className="font-mono">{row?.item_no || '—'}</td>
                  <td>{row?.description || '—'}</td>
                  <td className="text-xs">
                    {isEditing ? (
                      <input
                        type="text"
                        value={draftLabel}
                        autoFocus
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(mark);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="qto-input w-full text-xs"
                        data-testid={`label-input-${mark.ref_id}`}
                      />
                    ) : (
                      <span data-testid={`label-text-${mark.ref_id}`}>{mark.label || '—'}</span>
                    )}
                  </td>
                  <td className="no-print">
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(mark)} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Save" data-testid={`save-label-${mark.ref_id}`}>
                            <Check className="w-4 h-4 text-qto-primary" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Cancel" data-testid={`cancel-label-${mark.ref_id}`}>
                            <X className="w-4 h-4 text-qto-text-secondary" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(mark)} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Edit label" data-testid={`edit-label-${mark.ref_id}`}>
                            <Pencil className="w-4 h-4 text-qto-text-secondary" />
                          </button>
                          <button onClick={() => onOpenMark(mark)} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Open on drawing" data-testid={`open-ref-${mark.ref_id}`}>
                            <ExternalLink className="w-4 h-4 text-qto-primary" />
                          </button>
                          <button onClick={() => handleDelete(mark)} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Delete mark" data-testid={`delete-ref-${mark.ref_id}`}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReferencesPanel;
