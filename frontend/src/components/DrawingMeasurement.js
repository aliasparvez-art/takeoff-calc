import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, ZoomIn, ZoomOut, Maximize, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import logger from '../lib/logger';
import {
  distancePx, calculateLinear, calculateRectangle,
  calculatePolygonArea, calculatePolylineLength, calculateCircle,
  drawMeasurement,
} from '../lib/geometry';
import MarkPopover from './measurement/MarkPopover';
import EditMarkPopover from './measurement/EditMarkPopover';
import ScaleControls from './measurement/ScaleControls';
import ToolPalette from './measurement/ToolPalette';
import MeasurementsList from './measurement/MeasurementsList';
import SendToBOQPanel from './measurement/SendToBOQPanel';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DrawingMeasurement = ({
  projectId, row, drawings, marks = [], targetField, focusMarkId, initialDrawingId,
  onClose, onSendToField, onMarkSaved, onMarksUpdate,
}) => {
  const [selectedDrawing, setSelectedDrawing] = useState(
    () => drawings.find((d) => d.id === initialDrawingId) || null
  );
  const [scale, setScale] = useState({ factor: 1.0, ratio: '1:1' });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [knownLength, setKnownLength] = useState('');

  const [mode, setMode] = useState(
    targetField === 'depth' ? null
      : targetField === 'mark' ? 'mark'
        : targetField ? 'linear'
          : null
  );
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);

  const [markPopover, setMarkPopover] = useState(null);
  const [markLabel, setMarkLabel] = useState('');
  const [markRowId, setMarkRowId] = useState(row?.id || '');
  const [editingMark, setEditingMark] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);

  const [depthInput, setDepthInput] = useState('');

  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfPagesRef = useRef([]); // array of off-screen canvases, one per page

  const loadDrawing = useCallback(async (drawing) => {
    if (!drawing) return;
    try {
      const resp = await fetch(`${API}/drawings/${drawing.id}/download`, { credentials: 'include' });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      const pages = [];
      if (drawing.filename.toLowerCase().endsWith('.pdf')) {
        const pdf = await pdfjsLib.getDocument(url).promise;
        for (let pn = 1; pn <= pdf.numPages; pn += 1) {
          const page = await pdf.getPage(pn);
          const viewport = page.getViewport({ scale: 1.5 });
          const off = document.createElement('canvas');
          off.width = viewport.width; off.height = viewport.height;
          await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;
          pages.push(off);
        }
      } else {
        const img = new Image();
        await new Promise((res) => { img.onload = res; img.src = url; });
        const off = document.createElement('canvas');
        off.width = img.width; off.height = img.height;
        off.getContext('2d').drawImage(img, 0, 0);
        pages.push(off);
      }
      pdfPagesRef.current = pages;
      setNumPages(pages.length);
      setCurrentPage(1);
      setScale({ factor: drawing.scale_factor || 1.0, ratio: drawing.scale_ratio || '1:1' });
      setZoom(1.0); setPan({ x: 0, y: 0 });
      setMeasurements([]); setCurrentPoints([]);
      // Render first page immediately (the [currentPage] effect won't fire if currentPage stays 1)
      requestAnimationFrame(() => {
        const src = pages[0];
        if (!src || !pdfCanvasRef.current || !overlayCanvasRef.current) return;
        pdfCanvasRef.current.width = src.width;
        pdfCanvasRef.current.height = src.height;
        overlayCanvasRef.current.width = src.width;
        overlayCanvasRef.current.height = src.height;
        pdfCanvasRef.current.getContext('2d').drawImage(src, 0, 0);
      });
      URL.revokeObjectURL(url);
    } catch (e) { logger.error('Load drawing failed:', e); }
  }, []);

  useEffect(() => {
    if (selectedDrawing) loadDrawing(selectedDrawing);
  }, [selectedDrawing, loadDrawing]);

  // Render current page to visible canvas
  useEffect(() => {
    const src = pdfPagesRef.current[currentPage - 1];
    if (!src || !pdfCanvasRef.current || !overlayCanvasRef.current) return;
    pdfCanvasRef.current.width = src.width;
    pdfCanvasRef.current.height = src.height;
    overlayCanvasRef.current.width = src.width;
    overlayCanvasRef.current.height = src.height;
    pdfCanvasRef.current.getContext('2d').drawImage(src, 0, 0);
    // also clear measurements/points when switching pages
    setMeasurements([]); setCurrentPoints([]); setMarkPopover(null);
  }, [currentPage, numPages]);

  // If we got a focusMarkId, auto-switch to that mark's page once marks/drawing settled
  useEffect(() => {
    if (!focusMarkId) return;
    const m = marks.find((mm) => mm.id === focusMarkId);
    if (m && m.page && m.page !== currentPage) setCurrentPage(m.page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMarkId, marks, numPages]);

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

  // Redraw overlay whenever measurements, marks, or focus changes
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
    const drawingMarks = selectedDrawing
      ? marks.filter((m) => m.drawing_id === selectedDrawing.id && (m.page || 1) === currentPage)
      : [];
    drawingMarks.forEach((m) => renderMark(ctx, m, m.id === focusMarkId));
  }, [measurements, calibrationLine, marks, selectedDrawing, focusMarkId, currentPage]);

  const toCanvasCoords = (e) => {
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
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

    // Inline-edit existing marks (hit test by radius), only when NOT actively measuring/marking
    if (selectedDrawing && !mode) {
      const hit = marks
        .filter((m) => m.drawing_id === selectedDrawing.id && (m.page || 1) === currentPage)
        .find((m) => Math.hypot(m.position_x - p.x, m.position_y - p.y) <= 18);
      if (hit) { setEditingMark(hit); return; }
    }

    if (mode === 'mark') {
      // Also allow clicking an existing mark while in 'mark' mode to edit it instead of creating
      const hit = marks
        .filter((m) => m.drawing_id === selectedDrawing.id && (m.page || 1) === currentPage)
        .find((m) => Math.hypot(m.position_x - p.x, m.position_y - p.y) <= 18);
      if (hit) { setEditingMark(hit); return; }
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
          value: area.toFixed(3), dimensions: { width: width.toFixed(3), height: height.toFixed(3) }, unit: 'm²',
        }]);
        setCurrentPoints([]);
      }
    } else if (mode === 'polygon' || mode === 'polyline') {
      setCurrentPoints([...currentPoints, p]);
    } else if (mode === 'circle') {
      if (currentPoints.length === 0) {
        setCurrentPoints([p]);
      } else {
        const { radius, diameter, circumference, area } = calculateCircle(currentPoints[0], p, scale.factor);
        setMeasurements([...measurements, {
          id: crypto.randomUUID(),
          type: 'circle',
          points: [currentPoints[0], p],
          value: area.toFixed(3),
          dimensions: { radius: radius.toFixed(3), diameter: diameter.toFixed(3), circumference: circumference.toFixed(3) },
          unit: 'm²',
        }]);
        setCurrentPoints([]);
      }
    }
  };

  const finishPolyline = () => {
    if (currentPoints.length < 2) return;
    const length = calculatePolylineLength(currentPoints, scale.factor);
    setMeasurements([...measurements, {
      id: crypto.randomUUID(), type: 'polyline', points: currentPoints,
      value: length.toFixed(3), unit: 'm',
    }]);
    setCurrentPoints([]);
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;
    const area = calculatePolygonArea(currentPoints, scale.factor);
    const xs = currentPoints.map((p) => p.x);
    const ys = currentPoints.map((p) => p.y);
    const bboxW = (Math.max(...xs) - Math.min(...xs)) / scale.factor;
    const bboxH = (Math.max(...ys) - Math.min(...ys)) / scale.factor;
    setMeasurements([...measurements, {
      id: crypto.randomUUID(), type: 'polygon', points: currentPoints,
      value: area.toFixed(3), dimensions: { width: bboxW.toFixed(3), height: bboxH.toFixed(3) }, unit: 'm²',
    }]);
    setCurrentPoints([]);
  };

  const applyCalibration = async () => {
    if (!calibrationLine || !calibrationLine.x2 || !knownLength) return;
    const px = distancePx({ x: calibrationLine.x1, y: calibrationLine.y1 }, { x: calibrationLine.x2, y: calibrationLine.y2 });
    const factor = px / parseFloat(knownLength);
    const ratio = `1:${Math.round(factor)}`;
    setScale({ factor, ratio });
    setIsCalibrating(false); setCalibrationLine(null); setKnownLength('');
    if (selectedDrawing) {
      try {
        await api.put(`/drawings/${selectedDrawing.id}/scale`, { scale_factor: factor, scale_ratio: ratio });
      } catch (e) { logger.error('Persist scale failed:', e); }
    }
  };

  const handleZoom = (delta) => setZoom((z) => Math.max(0.25, Math.min(4, z + delta)));
  const fitZoom = () => { setZoom(1.0); setPan({ x: 0, y: 0 }); };
  const handleWheel = (e) => { e.preventDefault(); handleZoom(e.deltaY < 0 ? 0.1 : -0.1); };
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
    const linear = measurements.find((m) => m.type === 'linear');
    if (linear && targetField) {
      onSendToField(targetField, parseFloat(linear.value), selectedDrawing);
    }
  };

  // Send helpers passed to SendToBOQPanel
  const sendLinearToL = (v) => onSendToField('length', v, selectedDrawing);
  const sendLinearToB = (v) => onSendToField('breadth', v, selectedDrawing);
  const sendPolylineToL = () => {
    const pl = [...measurements].reverse().find((m) => m.type === 'polyline');
    if (pl) onSendToField('length', parseFloat(pl.value), selectedDrawing);
  };
  const sendRectToLB = () => {
    const rect = [...measurements].reverse().find((m) => m.type === 'rectangle');
    if (!rect || !rect.dimensions) return;
    onSendToField('length+breadth', {
      length: parseFloat(rect.dimensions.width),
      breadth: parseFloat(rect.dimensions.height),
    }, selectedDrawing);
  };
  const sendPolyBBoxToLB = () => {
    const poly = [...measurements].reverse().find((m) => m.type === 'polygon');
    if (!poly) return;
    const side = Math.sqrt(parseFloat(poly.value));
    onSendToField('length+breadth', {
      length: parseFloat(side.toFixed(3)),
      breadth: parseFloat(side.toFixed(3)),
    }, selectedDrawing);
  };
  const sendCircleLinearToL = () => {
    const c = [...measurements].reverse().find((m) => m.type === 'circle');
    if (c && c.dimensions) onSendToField('length', parseFloat(c.dimensions.circumference), selectedDrawing);
  };
  const sendCircleAreaToLB = () => {
    const c = [...measurements].reverse().find((m) => m.type === 'circle');
    if (!c || !c.dimensions) return;
    const r = parseFloat(c.dimensions.radius);
    onSendToField('length+breadth', {
      length: parseFloat(r.toFixed(3)),
      breadth: parseFloat((Math.PI * r).toFixed(3)),
    }, selectedDrawing);
  };
  const sendAreaToL = () => {
    const m = [...measurements].reverse().find((x) => x.type === 'rectangle' || x.type === 'polygon');
    if (m) onSendToField('length', parseFloat(m.value), selectedDrawing);
  };

  const hasLinear = measurements.some((m) => m.type === 'linear');
  const hasRect = measurements.some((m) => m.type === 'rectangle');
  const hasPoly = measurements.some((m) => m.type === 'polygon');
  const hasPolyline = measurements.some((m) => m.type === 'polyline');
  const hasCircle = measurements.some((m) => m.type === 'circle');

  const saveMark = async () => {
    if (!markPopover || !selectedDrawing) return;
    try {
      const { data } = await api.post(`/projects/${projectId}/marks`, {
        drawing_id: selectedDrawing.id,
        page: currentPage,
        position_x: markPopover.x,
        position_y: markPopover.y,
        boq_row_id: markRowId,
        label: markLabel,
      });
      onMarkSaved && onMarkSaved(data, markRowId);
      setMarkPopover(null); setMarkLabel('');
    } catch (e) { logger.error('Save mark failed:', e); }
  };

  const handleEditMarkSave = async (newLabel) => {
    if (!editingMark) return;
    try {
      await api.patch(`/projects/${projectId}/marks/${editingMark.id}`, { label: newLabel });
      onMarksUpdate && onMarksUpdate();
    } catch (e) { logger.error('Update mark failed:', e); }
    finally { setEditingMark(null); }
  };

  const handleEditMarkDelete = async () => {
    if (!editingMark) return;
    try {
      await api.delete(`/projects/${projectId}/marks/${editingMark.id}`);
      onMarksUpdate && onMarksUpdate();
    } catch (e) { logger.error('Delete mark failed:', e); }
    finally { setEditingMark(null); }
  };

  const exportMarkedUp = () => {
    if (!selectedDrawing) return;
    const src = pdfPagesRef.current[currentPage - 1];
    if (!src) return;
    const out = document.createElement('canvas');
    const legendH = 60;
    out.width = src.width; out.height = src.height + legendH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    const drawingMarks = marks.filter((m) => m.drawing_id === selectedDrawing.id && (m.page || 1) === currentPage);
    drawingMarks.forEach((m) => renderMark(ctx, m, false));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, src.height, out.width, legendH);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    ctx.strokeRect(0, src.height, out.width, legendH);
    ctx.fillStyle = '#0F172A';
    ctx.font = '14px IBM Plex Sans';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const date = new Date().toLocaleDateString();
    ctx.fillText(`Drawing: ${selectedDrawing.filename} pg.${currentPage}/${numPages}`, 16, src.height + 20);
    ctx.fillText(`Marks: ${drawingMarks.length}    |    Exported: ${date}`, 16, src.height + 42);
    const link = document.createElement('a');
    link.href = out.toDataURL('image/png');
    link.download = `${selectedDrawing.filename.replace(/\.[^.]+$/, '')}_pg${currentPage}_marked.png`;
    link.click();
  };

  const calibratedSummary = scale.factor !== 1.0
    ? `Scale: 1px = ${(1 / scale.factor).toFixed(4)} m  (${scale.ratio})`
    : null;

  const startCalibrate = () => { setIsCalibrating(true); setCalibrationLine(null); };

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

            {selectedDrawing && targetField !== 'depth' && (
              <>
                <ScaleControls
                  calibratedSummary={calibratedSummary}
                  isCalibrating={isCalibrating}
                  calibrationLine={calibrationLine}
                  knownLength={knownLength}
                  setKnownLength={setKnownLength}
                  onStartCalibrate={startCalibrate}
                  onApplyCalibration={applyCalibration}
                />
                <ToolPalette
                  mode={mode}
                  setMode={(m) => { setMode(m); setCurrentPoints([]); }}
                  currentPoints={currentPoints}
                  onFinishPolygon={finishPolygon}
                  onFinishPolyline={finishPolyline}
                />
                <MeasurementsList measurements={measurements} />
                <SendToBOQPanel
                  row={row}
                  measurements={measurements}
                  hasLinear={hasLinear} hasRect={hasRect} hasPoly={hasPoly}
                  hasPolyline={hasPolyline} hasCircle={hasCircle}
                  onSendLinearToL={sendLinearToL}
                  onSendLinearToB={sendLinearToB}
                  onSendPolylineToL={sendPolylineToL}
                  onSendRectToLB={sendRectToLB}
                  onSendPolyToLB={sendPolyBBoxToLB}
                  onSendCircleLinearToL={sendCircleLinearToL}
                  onSendCircleAreaToLB={sendCircleAreaToLB}
                  onSendAreaToL={sendAreaToL}
                />
                <button onClick={exportMarkedUp} disabled={!selectedDrawing}
                  className="qto-btn-secondary w-full text-xs flex items-center justify-center gap-1" data-testid="export-markup">
                  <Download className="w-3 h-3" /> Export Marked-Up PNG
                </button>
              </>
            )}

            {targetField === 'mark' && !selectedDrawing && (
              <p className="text-xs text-qto-text-secondary mt-2">
                Select a drawing above, then click the [Ref Mark] tool and click on the drawing to place a marker.
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
                <div className="qto-canvas-toolbar" data-testid="zoom-toolbar">
                  <button onClick={() => handleZoom(-0.1)} className="p-1 hover:bg-qto-surface-active rounded" title="Zoom out"><ZoomOut className="w-4 h-4 text-qto-text-primary" /></button>
                  <button onClick={fitZoom} className="px-2 py-1 text-xs hover:bg-qto-surface-active rounded font-mono" title="Fit"><Maximize className="w-4 h-4 text-qto-text-primary" /></button>
                  <button onClick={() => handleZoom(0.1)} className="p-1 hover:bg-qto-surface-active rounded" title="Zoom in"><ZoomIn className="w-4 h-4 text-qto-text-primary" /></button>
                  <span className="text-xs font-mono text-qto-text-primary px-2">{Math.round(zoom * 100)}%</span>
                  {numPages > 1 && (
                    <>
                      <span className="w-px h-4 bg-qto-border mx-1" />
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1 hover:bg-qto-surface-active rounded disabled:opacity-30" title="Previous page" data-testid="prev-page"><ChevronLeft className="w-4 h-4 text-qto-text-primary" /></button>
                      <span className="text-xs font-mono text-qto-text-primary px-1" data-testid="page-indicator">
                        Pg {currentPage}/{numPages}
                      </span>
                      <button onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="p-1 hover:bg-qto-surface-active rounded disabled:opacity-30" title="Next page" data-testid="next-page"><ChevronRight className="w-4 h-4 text-qto-text-primary" /></button>
                    </>
                  )}
                  <span className="text-xs text-qto-text-secondary px-2">Shift+drag to pan · click mark to edit</span>
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
                  <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left', display: 'inline-block', position: 'relative' }}>
                    <canvas ref={pdfCanvasRef} className="block" />
                    <canvas ref={overlayCanvasRef} onClick={handleCanvasClick} className="absolute top-0 left-0" data-testid="measurement-canvas" />
                  </div>

                  {markPopover && (
                    <MarkPopover
                      position={markPopover}
                      row={row}
                      markRowId={markRowId}
                      setMarkRowId={setMarkRowId}
                      markLabel={markLabel}
                      setMarkLabel={setMarkLabel}
                      onCancel={() => { setMarkPopover(null); setMarkLabel(''); }}
                      onSave={saveMark}
                    />
                  )}
                  {editingMark && (
                    <EditMarkPopover
                      mark={editingMark}
                      onClose={() => setEditingMark(null)}
                      onSave={handleEditMarkSave}
                      onDelete={handleEditMarkDelete}
                    />
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
