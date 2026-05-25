import React, { useState, useRef, useCallback } from 'react';
import { X, Save } from 'lucide-react';

import MeasurementToolbar from './MeasurementToolbar';
import MeasurementList from './MeasurementList';
import ScaleCalibrationPanel from './ScaleCalibrationPanel';
import useDrawingLoader from '../hooks/useDrawingLoader';
import {
  distancePx,
  calculateLinear,
  calculateRectangle,
  calculatePolygonArea,
  drawMeasurement,
} from '../lib/geometry';

const DrawingMeasurement = ({ row, drawings, onClose, onUpdate }) => {
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [scale, setScale] = useState({ factor: 1.0, ratio: '1:1' });

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [knownLength, setKnownLength] = useState('');

  // Measurement state
  const [measurementMode, setMeasurementMode] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);

  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);

  useDrawingLoader(selectedDrawing, canvasRef, setScale);

  const drawCalibrationLine = useCallback((line) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }, []);

  const renderMeasurement = useCallback((measurement) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    drawMeasurement(canvas.getContext('2d'), measurement);
  }, []);

  const handleCanvasClick = (e) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (isCalibrating) {
      if (!calibrationLine) {
        setCalibrationLine({ x1: point.x, y1: point.y });
      } else {
        const completed = { ...calibrationLine, x2: point.x, y2: point.y };
        setCalibrationLine(completed);
        drawCalibrationLine(completed);
      }
      return;
    }

    if (measurementMode === 'linear') {
      if (currentPoints.length === 0) {
        setCurrentPoints([point]);
      } else {
        const p1 = currentPoints[0];
        const value = calculateLinear(p1, point, scale.factor).toFixed(3);
        const m = { id: crypto.randomUUID(), type: 'linear', points: [p1, point], value, unit: 'm' };
        setMeasurements([...measurements, m]);
        setCurrentPoints([]);
        renderMeasurement(m);
      }
    } else if (measurementMode === 'rectangle') {
      if (currentPoints.length === 0) {
        setCurrentPoints([point]);
      } else {
        const p1 = currentPoints[0];
        const { width, height, area } = calculateRectangle(p1, point, scale.factor);
        const m = {
          id: crypto.randomUUID(),
          type: 'rectangle',
          points: [p1, point],
          value: area.toFixed(3),
          dimensions: { width: width.toFixed(3), height: height.toFixed(3) },
          unit: 'm²',
        };
        setMeasurements([...measurements, m]);
        setCurrentPoints([]);
        renderMeasurement(m);
      }
    } else if (measurementMode === 'polygon') {
      setCurrentPoints([...currentPoints, point]);
    }
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;
    const area = calculatePolygonArea(currentPoints, scale.factor);
    const m = {
      id: crypto.randomUUID(),
      type: 'polygon',
      points: currentPoints,
      value: area.toFixed(3),
      unit: 'm²',
    };
    setMeasurements([...measurements, m]);
    renderMeasurement(m);
    setCurrentPoints([]);
  };

  const handleApplyCalibration = () => {
    if (!calibrationLine || !knownLength) return;
    const pixelDistance = distancePx(
      { x: calibrationLine.x1, y: calibrationLine.y1 },
      { x: calibrationLine.x2, y: calibrationLine.y2 }
    );
    const scaleFactor = pixelDistance / parseFloat(knownLength);
    setScale({ factor: scaleFactor, ratio: `1:${Math.round(scaleFactor)}` });
    setIsCalibrating(false);
    setCalibrationLine(null);
    setKnownLength('');
  };

  const handleModeChange = (mode) => {
    setMeasurementMode(mode);
    setCurrentPoints([]);
  };

  const handleUseTheseMeasurements = () => {
    let length = 0, breadth = 0;
    const linearMs = measurements.filter((m) => m.type === 'linear');
    const areaMs = measurements.filter((m) => m.type === 'rectangle' || m.type === 'polygon');
    if (linearMs.length > 0) length = parseFloat(linearMs[0].value);
    if (areaMs.length > 0 && areaMs[0].dimensions) {
      length = parseFloat(areaMs[0].dimensions.width);
      breadth = parseFloat(areaMs[0].dimensions.height);
    } else if (areaMs.length > 0) {
      breadth = parseFloat(areaMs[0].value);
    }
    onUpdate({
      length,
      breadth,
      depth: 0,
      drawing_ref: selectedDrawing?.filename || '',
      nos: row.nos,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" data-testid="drawing-measurement-modal">
      <div className="qto-panel w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="p-4 border-b border-qto-border flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold text-qto-text-primary">
            Measure from Drawing
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-qto-surface-hover rounded-qto transition-qto"
            data-testid="close-measurement-modal"
          >
            <X className="w-5 h-5 text-qto-text-secondary" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-qto-border p-4 overflow-y-auto">
            <div className="mb-6">
              <label className="qto-label">Select Drawing</label>
              <select
                value={selectedDrawing?.id || ''}
                onChange={(e) => {
                  const d = drawings.find((dr) => dr.id === e.target.value);
                  setSelectedDrawing(d);
                }}
                className="qto-input w-full"
                data-testid="drawing-select"
              >
                <option value="">-- Select --</option>
                {drawings.map((d) => (
                  <option key={d.id} value={d.id}>{d.filename}</option>
                ))}
              </select>
              {drawings.length === 0 && (
                <p className="text-xs text-qto-text-secondary mt-2">
                  No drawings uploaded yet. Upload drawings in the Drawings tab.
                </p>
              )}
            </div>

            {selectedDrawing && (
              <>
                <ScaleCalibrationPanel
                  scale={scale}
                  isCalibrating={isCalibrating}
                  calibrationLine={calibrationLine}
                  knownLength={knownLength}
                  onStartCalibration={() => setIsCalibrating(true)}
                  onChangeKnownLength={setKnownLength}
                  onApplyCalibration={handleApplyCalibration}
                />
                <MeasurementToolbar
                  mode={measurementMode}
                  onModeChange={handleModeChange}
                  onFinishPolygon={finishPolygon}
                  canFinishPolygon={currentPoints.length >= 3}
                />
                <MeasurementList measurements={measurements} />
                <button
                  onClick={handleUseTheseMeasurements}
                  disabled={measurements.length === 0}
                  className="qto-btn w-full flex items-center justify-center gap-2"
                  data-testid="use-measurements"
                >
                  <Save className="w-4 h-4" />
                  Use These Measurements
                </button>
              </>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 qto-canvas-container relative" data-testid="canvas-container">
            {!selectedDrawing ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-qto-text-secondary">Select a drawing to start measuring</p>
              </div>
            ) : (
              <div className="relative">
                <canvas ref={canvasRef} className="absolute top-0 left-0" />
                <canvas
                  ref={drawingCanvasRef}
                  onClick={handleCanvasClick}
                  width={canvasRef.current?.width || 800}
                  height={canvasRef.current?.height || 600}
                  className="absolute top-0 left-0 cursor-crosshair"
                  data-testid="measurement-canvas"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingMeasurement;
