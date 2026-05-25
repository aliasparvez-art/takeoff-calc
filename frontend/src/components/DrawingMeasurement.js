import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Pentagon, Ruler, Save } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DrawingMeasurement = ({ rowId, row, drawings, onClose, onUpdate }) => {
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [scale, setScale] = useState({ factor: 1.0, ratio: '1:1' });
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState(null);
  const [knownLength, setKnownLength] = useState('');
  const [measurementMode, setMeasurementMode] = useState(null); // 'linear', 'rectangle', 'polygon'
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [pdfDoc, setPdfDoc] = useState(null);
  
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);

  useEffect(() => {
    if (selectedDrawing) {
      loadDrawing(selectedDrawing);
    }
  }, [selectedDrawing]);

  const loadDrawing = async (drawing) => {
    try {
      const response = await fetch(`${API}/drawings/${drawing.id}/download`, {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (drawing.filename.toLowerCase().endsWith('.pdf')) {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        renderPDFPage(pdf, 1);
      } else {
        // Image file (PNG/JPG fallback for DWG)
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
        };
        img.src = url;
      }

      setScale({
        factor: drawing.scale_factor || 1.0,
        ratio: drawing.scale_ratio || '1:1'
      });
    } catch (error) {
      console.error('Error loading drawing:', error);
    }
  };

  const renderPDFPage = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const ctx = canvas.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isCalibrating) {
      if (!calibrationLine) {
        setCalibrationLine({ x1: x, y1: y });
      } else {
        setCalibrationLine({ ...calibrationLine, x2: x, y2: y });
        drawCalibrationLine({ ...calibrationLine, x2: x, y2: y });
      }
      return;
    }

    if (measurementMode === 'linear') {
      if (currentPoints.length === 0) {
        setCurrentPoints([{ x, y }]);
      } else {
        const p1 = currentPoints[0];
        const distance = Math.sqrt(Math.pow(x - p1.x, 2) + Math.pow(y - p1.y, 2));
        const realDistance = (distance / scale.factor).toFixed(3);
        setMeasurements([...measurements, {
          type: 'linear',
          points: [p1, { x, y }],
          value: realDistance,
          unit: 'm'
        }]);
        setCurrentPoints([]);
        drawMeasurement({ type: 'linear', points: [p1, { x, y }], value: realDistance });
      }
    } else if (measurementMode === 'rectangle') {
      if (currentPoints.length === 0) {
        setCurrentPoints([{ x, y }]);
      } else {
        const p1 = currentPoints[0];
        const width = Math.abs(x - p1.x) / scale.factor;
        const height = Math.abs(y - p1.y) / scale.factor;
        const area = (width * height).toFixed(3);
        setMeasurements([...measurements, {
          type: 'rectangle',
          points: [p1, { x, y }],
          value: area,
          dimensions: { width: width.toFixed(3), height: height.toFixed(3) },
          unit: 'm²'
        }]);
        setCurrentPoints([]);
        drawMeasurement({ type: 'rectangle', points: [p1, { x, y }] });
      }
    } else if (measurementMode === 'polygon') {
      setCurrentPoints([...currentPoints, { x, y }]);
    }
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;
    
    // Calculate polygon area using shoelace formula
    let area = 0;
    for (let i = 0; i < currentPoints.length; i++) {
      const j = (i + 1) % currentPoints.length;
      area += currentPoints[i].x * currentPoints[j].y;
      area -= currentPoints[j].x * currentPoints[i].y;
    }
    area = Math.abs(area / 2) / (scale.factor * scale.factor);
    
    setMeasurements([...measurements, {
      type: 'polygon',
      points: currentPoints,
      value: area.toFixed(3),
      unit: 'm²'
    }]);
    drawMeasurement({ type: 'polygon', points: currentPoints });
    setCurrentPoints([]);
  };

  const drawCalibrationLine = (line) => {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  };

  const drawMeasurement = (measurement) => {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#10B981';
    ctx.fillStyle = '#10B981';
    ctx.lineWidth = 2;

    if (measurement.type === 'linear') {
      const [p1, p2] = measurement.points;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (measurement.type === 'rectangle') {
      const [p1, p2] = measurement.points;
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (measurement.type === 'polygon') {
      ctx.beginPath();
      ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
      for (let i = 1; i < measurement.points.length; i++) {
        ctx.lineTo(measurement.points[i].x, measurement.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  };

  const handleCalibrate = () => {
    if (!calibrationLine || !knownLength) return;
    
    const pixelDistance = Math.sqrt(
      Math.pow(calibrationLine.x2 - calibrationLine.x1, 2) +
      Math.pow(calibrationLine.y2 - calibrationLine.y1, 2)
    );
    const scaleFactor = pixelDistance / parseFloat(knownLength);
    
    setScale({
      factor: scaleFactor,
      ratio: `1:${Math.round(scaleFactor)}`
    });
    setIsCalibrating(false);
    setCalibrationLine(null);
    setKnownLength('');
  };

  const handleUseTheseMeasurements = () => {
    // Calculate from measurements
    let length = 0, breadth = 0, depth = 0;
    
    const linearMeasurements = measurements.filter(m => m.type === 'linear');
    const areaMeasurements = measurements.filter(m => m.type === 'rectangle' || m.type === 'polygon');
    
    if (linearMeasurements.length > 0) {
      length = parseFloat(linearMeasurements[0].value);
    }
    
    if (areaMeasurements.length > 0 && areaMeasurements[0].dimensions) {
      length = parseFloat(areaMeasurements[0].dimensions.width);
      breadth = parseFloat(areaMeasurements[0].dimensions.height);
    } else if (areaMeasurements.length > 0) {
      breadth = parseFloat(areaMeasurements[0].value);
    }
    
    onUpdate({
      length,
      breadth,
      depth,
      drawing_ref: selectedDrawing?.filename || '',
      nos: row.nos
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
                  const drawing = drawings.find(d => d.id === e.target.value);
                  setSelectedDrawing(drawing);
                }}
                className="qto-input w-full"
                data-testid="drawing-select"
              >
                <option value="">-- Select --</option>
                {drawings.map(d => (
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
                {/* Scale Calibration */}
                <div className="mb-6 p-4 bg-qto-bg rounded-qto">
                  <h4 className="qto-label mb-3">Scale Calibration</h4>
                  <div className="text-xs text-qto-text-secondary mb-3 font-mono">
                    Current: {scale.ratio} (1px = {(1/scale.factor).toFixed(4)}m)
                  </div>
                  {!isCalibrating ? (
                    <button
                      onClick={() => setIsCalibrating(true)}
                      className="qto-btn-secondary w-full"
                      data-testid="start-calibration"
                    >
                      Calibrate Scale
                    </button>
                  ) : (
                    <div>
                      <p className="text-xs text-qto-text-secondary mb-2">
                        {!calibrationLine ? 'Click to start line' : calibrationLine.x2 ? 'Enter known length' : 'Click to end line'}
                      </p>
                      {calibrationLine?.x2 && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            value={knownLength}
                            onChange={(e) => setKnownLength(e.target.value)}
                            placeholder="Known length (m)"
                            className="qto-input w-full mb-2"
                            data-testid="known-length-input"
                          />
                          <button
                            onClick={handleCalibrate}
                            className="qto-btn w-full"
                            data-testid="apply-calibration"
                          >
                            Apply
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Measurement Tools */}
                <div className="mb-6">
                  <h4 className="qto-label mb-3">Measurement Tools</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setMeasurementMode('linear');
                        setCurrentPoints([]);
                      }}
                      className={`qto-btn-secondary flex items-center justify-center gap-2 ${
                        measurementMode === 'linear' ? 'bg-qto-primary text-qto-primary-text' : ''
                      }`}
                      data-testid="linear-tool"
                    >
                      <Minus className="w-4 h-4" />
                      Linear
                    </button>
                    <button
                      onClick={() => {
                        setMeasurementMode('rectangle');
                        setCurrentPoints([]);
                      }}
                      className={`qto-btn-secondary flex items-center justify-center gap-2 ${
                        measurementMode === 'rectangle' ? 'bg-qto-primary text-qto-primary-text' : ''
                      }`}
                      data-testid="rectangle-tool"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Rectangle
                    </button>
                    <button
                      onClick={() => {
                        setMeasurementMode('polygon');
                        setCurrentPoints([]);
                      }}
                      className={`qto-btn-secondary flex items-center justify-center gap-2 ${
                        measurementMode === 'polygon' ? 'bg-qto-primary text-qto-primary-text' : ''
                      }`}
                      data-testid="polygon-tool"
                    >
                      <Pentagon className="w-4 h-4" />
                      Polygon
                    </button>
                    {measurementMode === 'polygon' && currentPoints.length >= 3 && (
                      <button
                        onClick={finishPolygon}
                        className="qto-btn"
                        data-testid="finish-polygon"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>

                {/* Measurements List */}
                <div className="mb-6">
                  <h4 className="qto-label mb-3">Captured Measurements</h4>
                  <div className="space-y-2">
                    {measurements.map((m, i) => (
                      <div key={i} className="p-2 bg-qto-bg rounded-qto text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-qto-text-secondary capitalize">{m.type}</span>
                          <span className="font-mono text-qto-primary font-bold">
                            {m.value} {m.unit}
                          </span>
                        </div>
                        {m.dimensions && (
                          <div className="text-xs text-qto-text-secondary font-mono mt-1">
                            {m.dimensions.width} × {m.dimensions.height} m
                          </div>
                        )}
                      </div>
                    ))}
                    {measurements.length === 0 && (
                      <p className="text-xs text-qto-text-secondary">No measurements yet</p>
                    )}
                  </div>
                </div>

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
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0"
                />
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
