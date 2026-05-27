import React from 'react';
import { ExternalLink } from 'lucide-react';

const ReferencesPanel = ({ marks, drawings, boqRows, onOpenMark }) => {
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
    <div className="qto-panel p-4" data-testid="references-panel">
      <h3 className="text-lg font-heading font-semibold text-qto-text-primary mb-4">
        Drawing Reference Index
      </h3>
      <div className="overflow-x-auto">
        <table className="qto-table w-full">
          <thead>
            <tr>
              <th className="w-24">Ref ID</th>
              <th className="w-48">Drawing + Page</th>
              <th className="w-24">BOQ Item No.</th>
              <th className="w-64">Description</th>
              <th className="w-48">Label / Note</th>
              <th className="w-16">Open</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((mark) => {
              const drawing = drawings.find((d) => d.id === mark.drawing_id);
              const row = boqRows.find((r) => r.id === mark.boq_row_id);
              return (
                <tr key={mark.id} data-testid={`ref-row-${mark.ref_id}`}>
                  <td className="font-mono text-qto-primary font-bold">{mark.ref_id}</td>
                  <td className="font-mono text-xs">{drawing?.filename || '—'} pg.{mark.page}</td>
                  <td className="font-mono">{row?.item_no || '—'}</td>
                  <td>{row?.description || '—'}</td>
                  <td className="text-xs">{mark.label || '—'}</td>
                  <td>
                    <button onClick={() => onOpenMark(mark)} className="p-1 hover:bg-qto-surface-hover rounded transition-qto" title="Open mark on drawing" data-testid={`open-ref-${mark.ref_id}`}>
                      <ExternalLink className="w-4 h-4 text-qto-primary" />
                    </button>
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
