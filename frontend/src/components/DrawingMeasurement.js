import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, Save, Minus, Maximize2, Pentagon, MapPin, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react';
import api from '../lib/api';
import logger from '../lib/logger';
import { distancePx, calculateLinear, calculateRectangle, calculatePolygonArea, drawMeasurement } from '../lib/geometry';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DrawingMeasurement = ({
  projectId, row, drawings, marks = [], targetField, focusMarkId, initialDrawingId,
  onClose, onSendToField, onMarkSaved, onMarksUpdate
}) => {
  const [selectedDrawing, setSelectedDrawing] = useState(
    () => drawings.find((d) => d.id === initialDrawingId) || null
  );
  const [scale, setScale] = useState({ factor: 1.0, ratio: '1:1' });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Calibration
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [knownLength, setKnownLength] = useState('');

  // Measurement
  const [mode, setMode] = useState(targetField === 'depth' ? null : (targetField ? 'linear' : null));
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);

  // Mark mode (Enhancement 6)
  const [markPopover, setMarkPopover] = useState(null); // { x, y, ref_id }
  const [markLabel, setMarkLabel] = useState('');
  const [markRowId, setMarkRowId] = useState(row?.id || '');

  // D/H overlay (Enhancement 5)
  const [depthInput, setDepthInput] = useState('');

  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfImageRef = useRef(null); // store the original rendered bitmap

  const loadDrawing = useCallback(async (drawing) => {
    if (!drawing) return;
    try {
      const resp = await fetch(`${API}/drawings/${drawing.id}/download`, { credentials: 'include' });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      if (drawing.filename.toLowerCase().endsWith('.pdf')) {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        // Render to offscreen canvas to keep the original bitmap
        const off = document.createElement('canvas');
        off.width = viewport.width; off.height = viewport.height;
        await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;
        pdfImageRef.current = off;
      } else {
        const img = new Image();
        await new Promise((res) => { img.onload = res; img.src = url; });
        const off = document.createElement('canvas');
        off.width = img.width; off.height = img.height;
        off.getContext('2d').drawImage(img, 0, 0);
        pdfImageRef.current = off;
      }
      // Sync visible canvases
      const w = pdfImageRef.current.width;
      const h = pdfImageRef.current.height;
      if (pdfCanvasRef.current) { pdfCanvasRef.current.width = w; pdfCanvasRef.current.height = h; }
      if (overlayCanvasRef.current) { overlayCanvasRef.current.width = w; overlayCanvasRef.current.height = h; }
      setScale({ factor: drawing.scale_factor || 1.0, ratio: drawing.scale_ratio || '1:1' });
      setZoom(1.0); setPan({ x: 0, y: 0 });
      setMeasurements([]); setCurrentPoints([]);
      // Render bitmap to visible canvas after the next paint to ensure canvas is mounted with new dims.
      requestAnimationFrame(() => {
        if (pdfCanvasRef.current && pdfImageRef.current) {
          pdfCanvasRef.current.getContext('2d').drawImage(pdfImageRef.current, 0, 0);
        }
      });
      URL.revokeObjectURL(url);
    } catch (e) { logger.error('Load drawing failed:', e); }
  }, []);

  useEffect(() => {
    if (selectedDrawing) loadDrawing(selectedDrawing);
  }, [selectedDrawing, loadDrawing]);

  // Redraw overlay whenever measurements, marks, zoom, or pan changes
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    measurements.forEach((m) => drawMeasurement(ctx, m));
    if (calibrationLine && calibrationLine.x2 != null) {
      ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(calibrationLine.x1, calibrationLine.y1);
      ctx.lineTo(calibrationLine.x2, calibrationLine.y2);
      ctx.stroke();
    }
    // Render marks for this drawing
    const drawingMarks = selectedDrawing ? marks.filter((m) => m.drawing_id === selectedDrawing.id) : [];
    drawingMarks.forEach((m) => renderMark(ctx, m, m.id === focusMarkId));
  }, [measurements, calibrationLine, marks, selectedDrawing, focusMarkId]);

  const renderMark = (ctx, mark, focused) => {
    const r = 16;
    ctx.beginPath();
    ctx.arc(mark.position_x, mark.position_y, r, 0, Math.PI * 2);
    ctx.fillStyle = focused ? '#FB923C' : '#F59E0B';
    ctx.fill();
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px JetBrains Mono';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const num = mark.ref_id.replace('REF-', '');
    ctx.fillText(num, mark.position_x, mark.position_y);
    if (focused) {
      ctx.strokeStyle = '#FB923C'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mark.position_x, mark.position_y, r + 6, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // Convert client mouse coords to canvas (drawing) coords, accounting for zoom+pan
  const toCanvasCoords = (e) => {
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    // The canvas is visually transformed by CSS scale(zoom) translate(pan).
    // We invert: subtract bounding rect origin, then divide by displayed-to-natural ratio.
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    // rect already reflects scale (because CSS transform applies)
    const nx = (cssX / rect.width) * overlayCanvasRef.current.width;
    const ny = (cssY / rect.height) * overlayCanvasRef.current.height;
    return { x: nx, y: ny };
  };

  const handleCanvasClick = (e) => {
    if (!overlayCanvasRef.current) return;
    if (isPanning) return;
    const p = toCanvasCoords(e);

    if (isCalibrating) {
      if (!calibrationLine) setCalibrationLine({ x1: p.x, y1: p.y });
      else setCalibrationLine({ ...calibrationLine, x2: p.x, y2: p.y });
      return;
    }

    if (mode === 'mark') {
      // Auto ref ID is allocated server-side; show popover for label + row
      setMarkPopover({ x: p.x, y: p.y });
      return;
    }

    if (mode === 'linear') {
      if (currentPoints.length === 0) setCurrentPoints([p]);
      else {
        const v = calculateLinear(currentPoints[0], p, scale.factor).toFixed(3);
        setMeasurements([...measurements, { id: crypto.randomUUID(), type: 'linear', points: [currentPoints[0], p], value: v, unit: 'm' }]);
        setCurrentPoints([]);
      }
    } else if (mode === 'rectangle') {
      if (currentPoints.length === 0) setCurrentPoints([p]);
      else {
        const { width, height, area } = calculateRectangle(currentPoints[0], p, scale.factor);
        setMeasurements([...measurements, {
          id: crypto.randomUUID(), type: 'rectangle', points: [currentPoints[0], p],
          value: area.toFixed(3), dimensions: { width: width.toFixed(3), height: height.toFixed(3) }, unit: 'm²'
        }]);
        setCurrentPoints([]);
      }
    } else if (mode === 'polygon') {
      setCurrentPoints([...currentPoints, p]);
    }
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;
    const area = calculatePolygonArea(currentPoints, scale.factor);
    setMeasurements([...measurements, { id: crypto.randomUUID(), type: 'polygon', points: currentPoints, value: area.toFixed(3), unit: 'm²' }]);
    setCurrentPoints([]);
  };

  const applyCalibration = async () => {
    if (!calibrationLine || !calibrationLine.x2 || !knownLength) return;
    const px = distancePx({ x: calibrationLine.x1, y: calibrationLine.y1 }, { x: calibrationLine.x2, y: calibrationLine.y2 });
    const factor = px / parseFloat(knownLength);
    const ratio = `1:${Math.round(factor)}`;
    setScale({ factor, ratio });
    setIsCalibrating(false); setCalibrationLine(null); setKnownLength('');
    // Persist (Enhancement 2)
    if (selectedDrawing) {
      try {
        await api.put(`/drawings/${selectedDrawing.id}/scale`, { scale_factor: factor, scale_ratio: ratio });
      } catch (e) { logger.error('Persist scale failed:', e); }
    }
  };

  const handleZoom = (delta) => setZoom((z) => Math.max(0.25, Math.min(4, z + delta)));
  const fitZoom = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };

  const handleWheel = (e) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 0.1 : -0.1);
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning) setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  const sendToField = () => {
    if (targetField === 'depth') {
      const v = parseFloat(depthInput) || 0;
      onSendToField('depth', v, selectedDrawing);
      return;
    }
    // For length / breadth: pick first linear measurement
    const linear = measurements.find((m) => m.type === 'linear');
    if (linear && targetField) {
      onSendToField(targetField, parseFloat(linear.value), selectedDrawing);
    }
  };

  const saveMark = async () => {
    if (!markPopover || !selectedDrawing) return;
    try {
      const { data } = await api.post(`/projects/${projectId}/marks`, {
        drawing_id: selectedDrawing.id,
        page: 1,
        position_x: markPopover.x,
        position_y: markPopover.y,
        boq_row_id: markRowId,
        label: markLabel,
      });
      onMarkSaved && onMarkSaved(data, markRowId);
      setMarkPopover(null); setMarkLabel('');
    } catch (e) { logger.error('Save mark failed:', e); }
  };

  const exportMarkedUp = () => {
    if (!selectedDrawing || !pdfImageRef.current) return;
    const src = pdfImageRef.current;
    const out = document.createElement('canvas');
    const legendH = 60;
    out.width = src.width; out.height = src.height + legendH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    // Marks
    const drawingMarks = marks.filter((m) => m.drawing_id === selectedDrawing.id);
    drawingMarks.forEach((m) => renderMark(ctx, m, false));
    // Legend strip
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, src.height, out.width, legendH);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    ctx.strokeRect(0, src.height, out.width, legendH);
    ctx.fillStyle = '#0F172A';
    ctx.font = '14px IBM Plex Sans';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const date = new Date().toLocaleDateString();
    ctx.fillText(`Drawing: ${selectedDrawing.filename} pg.1`, 16, src.height + 20);
    ctx.fillText(`Marks: ${drawingMarks.length}    |    Exported: ${date}`, 16, src.height + 42);
    const link = document.createElement('a');
    link.href = out.toDataURL('image/png');
    link.download = `${selectedDrawing.filename.replace(/\.[^.]+$/, '')}_marked.png`;
    link.click();
  };

  const calibratedSummary = scale.factor !== 1.0
    ? `Scale: 1px = ${(1 / scale.factor).toFixed(4)} m  (${scale.ratio})`
    : null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" data-testid="drawing-measurement-modal">
      <div className="qto-panel w-full max-w-7xl h-[92vh] flex flex-col">
        <div className="p-4 border-b border-qto-border flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
            {targetField === 'mark' ? 'Add Reference Mark' : (targetField ? `Measure → ${targetField.toUpperCase()}` : 'Measure from Drawing')}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-qto-surface-hover rounded-qto transition-qto" data-testid="close-measurement-modal">
            <X className="w-5 h-5 text-qto-text-secondary" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-qto-border p-4 overflow-y-auto">
            <div className="mb-4">
              <label className="qto-label">Drawing</label>
              <select value={selectedDrawing?.id || ''}
                onChange={(e) => setSelectedDrawing(drawings.find((d) => d.id === e.target.value))}
                className="qto-input w-full" data-testid="drawing-select">
                <option value="">-- Select --</option>
                {drawings.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
              </select>
              {drawings.length === 0 && (
                <p className="text-xs text-qto-text-secondary mt-2">No drawings uploaded yet.</p>
              )}
            </div>

            {selectedDrawing && targetField === 'depth' && (
              <div className="mb-4 p-3 bg-qto-bg rounded-qto">
                <p className="text-xs text-qto-text-secondary mb-2">
                  D/H cannot be measured from a plan drawing — enter value:
                </p>
                <input type="number" step="0.01" value={depthInput} onChange={(e) => setDepthInput(e.target.value)}
                  placeholder="Depth/Height (m)" className="qto-input w-full mb-2" data-testid="depth-input-overlay" />
                <button onClick={sendToField} disabled={!depthInput} className="qto-btn w-full" data-testid="send-depth">
                  → Send to D/H
                </button>
              </div>
            )}

            {selectedDrawing && targetField !== 'depth' && targetField !== 'mark' && (
              <>
                {/* Scale Status (Enhancement 2) */}
                <div className="mb-4 p-3 bg-qto-bg rounded-qto" data-testid="scale-status">
                  {calibratedSummary ? (
                    <>
                      <p className="text-xs font-mono text-qto-text-primary">{calibratedSummary}</p>
                      <button onClick={() => { setIsCalibrating(true); setCalibrationLine(null); }}
                        className="qto-btn-secondary w-full mt-2 text-xs" data-testid="recalibrate-button">
                        Recalibrate
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-qto-primary font-mono">⚠ Not calibrated</p>
                      <button onClick={() => { setIsCalibrating(true); setCalibrationLine(null); }}
                        className="qto-btn w-full mt-2 text-xs" data-testid="set-scale-button">
                        Set Scale
                      </button>
                    </>
                  )}
                  {isCalibrating && (
                    <div className="mt-2">
                      <p className="text-xs text-qto-text-secondary mb-1">
                        {!calibrationLine ? 'Click to start line' : !calibrationLine.x2 ? 'Click to end line' : 'Enter known length'}
                      </p>
                      {calibrationLine?.x2 && (
                        <>
                          <input type="number" step="0.01" value={knownLength} onChange={(e) => setKnownLength(e.target.value)}
                            placeholder="Length (m)" className="qto-input w-full text-xs mb-1" data-testid="known-length-input" />
                          <button onClick={applyCalibration} className="qto-btn w-full text-xs" data-testid="apply-calibration">Apply</button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Tools */}
                <div className="mb-4">
                  <label className="qto-label">Tools</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setMode('linear'); setCurrentPoints([]); }} className={`qto-btn-secondary flex items-center gap-1 text-xs ${mode === 'linear' ? 'bg-qto-primary text-qto-primary-text' : ''}`} data-testid="linear-tool">
                      <Minus className="w-3 h-3" /> Linear
                    </button>
                    <button onClick={() => { setMode('rectangle'); setCurrentPoints([]); }} className={`qto-btn-secondary flex items-center gap-1 text-xs ${mode === 'rectangle' ? 'bg-qto-primary text-qto-primary-text' : ''}`} data-testid="rectangle-tool">
                      <Maximize2 className="w-3 h-3" /> Rectangle
                    </button>
                    <button onClick={() => { setMode('polygon'); setCurrentPoints([]); }} className={`qto-btn-secondary flex items-center gap-1 text-xs ${mode === 'polygon' ? 'bg-qto-primary text-qto-primary-text' : ''}`} data-testid="polygon-tool">
                      <Pentagon className="w-3 h-3" /> Polygon
                    </button>
                    <button onClick={() => { setMode('mark'); setCurrentPoints([]); }} className={`qto-btn-secondary flex items-center gap-1 text-xs ${mode === 'mark' ? 'bg-cyan-500 text-white' : ''}`} data-testid="mark-tool">
                      <MapPin className="w-3 h-3" /> Ref Mark
                    </button>
                    {mode === 'polygon' && currentPoints.length >= 3 && (
                      <button onClick={finishPolygon} className="qto-btn col-span-2 text-xs" data-testid="finish-polygon">Close Polygon</button>
                    )}
                  </div>
                </div>

                {/* Measurements list */}
                <div className="mb-4">
                  <label className="qto-label">Captured ({measurements.length})</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {measurements.map((m) => (
                      <div key={m.id} className="p-2 bg-qto-bg rounded-qto text-xs flex justify-between">
                        <span className="text-qto-text-secondary capitalize">{m.type}</span>
                        <span className="font-mono text-qto-primary font-bold">{m.value} {m.unit}</span>
                      </div>
                    ))}
                    {measurements.length === 0 && <p className="text-xs text-qto-text-secondary">No measurements yet</p>}
                  </div>
                </div>

                {targetField && (
                  <button onClick={sendToField} disabled={measurements.length === 0}
                    className="qto-btn w-full text-xs flex items-center justify-center gap-1 mb-2" data-testid="send-to-field">
                    <Save className="w-3 h-3" /> Send to {targetField === 'length' ? 'L' : targetField === 'breadth' ? 'B' : 'D/H'}
                  </button>
                )}

                <button onClick={exportMarkedUp} disabled={!selectedDrawing}
                  className="qto-btn-secondary w-full text-xs flex items-center justify-center gap-1" data-testid="export-markup">
                  <Download className="w-3 h-3" /> Export Marked-Up PNG
                </button>
              </>
            )}

            {targetField === 'mark' && (
              <p className="text-xs text-qto-text-secondary mt-2">
                Click anywhere on the drawing to place a reference mark.
              </p>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 qto-canvas-container relative overflow-hidden" data-testid="canvas-container" ref={containerRef}>
            {!selectedDrawing ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-qto-text-secondary">Select a drawing to start</p>
              </div>
            ) : (
              <>
                {/* Zoom toolbar (Enhancement 3) */}
                <div className="qto-canvas-toolbar" data-testid="zoom-toolbar">
                  <button onClick={() => handleZoom(-0.1)} className="p-1 hover:bg-qto-surface-active rounded" title="Zoom out"><ZoomOut className="w-4 h-4 text-qto-text-primary" /></button>
                  <button onClick={fitZoom} className="px-2 py-1 text-xs hover:bg-qto-surface-active rounded font-mono" title="Fit"><Maximize className="w-4 h-4 text-qto-text-primary" /></button>
                  <button onClick={() => handleZoom(0.1)} className="p-1 hover:bg-qto-surface-active rounded" title="Zoom in"><ZoomIn className="w-4 h-4 text-qto-text-primary" /></button>
                  <span className="text-xs font-mono text-qto-text-primary px-2">{Math.round(zoom * 100)}%</span>
                  <span className="text-xs text-qto-text-secondary px-2">Shift+drag to pan</span>
                </div>

                <div
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="w-full h-full relative"
                  style={{ cursor: isPanning ? 'grabbing' : (mode || isCalibrating ? 'crosshair' : 'default') }}
                >
                  <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                    <canvas ref={pdfCanvasRef} className="absolute top-0 left-0" />
                    <canvas ref={overlayCanvasRef} onClick={handleCanvasClick} className="absolute top-0 left-0" data-testid="measurement-canvas" />
                  </div>

                  {/* Mark popover */}
                  {markPopover && (
                    <div className="absolute bg-qto-surface border border-qto-primary rounded-qto p-3 shadow-lg z-30"
                      style={{ left: markPopover.x * zoom + pan.x + 20, top: markPopover.y * zoom + pan.y - 80 }}
                      data-testid="mark-popover">
                      <div className="mb-2">
                        <label className="qto-label">Link to BOQ Row</label>
                        <select value={markRowId} onChange={(e) => setMarkRowId(e.target.value)} className="qto-input w-full text-xs" data-testid="mark-row-select">
                          <option value="">-- Optional --</option>
                          {row && <option value={row.id}>{row.item_no} - {row.description}</option>}
                        </select>
                      </div>
                      <div className="mb-2">
                        <label className="qto-label">Label</label>
                        <input type="text" value={markLabel} onChange={(e) => setMarkLabel(e.target.value)}
                          placeholder="e.g. Column base pad" className="qto-input w-full text-xs" data-testid="mark-label" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setMarkPopover(null)} className="qto-btn-secondary text-xs flex-1">Cancel</button>
                        <button onClick={saveMark} className="qto-btn text-xs flex-1" data-testid="save-mark">Save Mark</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingMeasurement;
