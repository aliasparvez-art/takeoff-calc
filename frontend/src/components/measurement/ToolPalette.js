import React from 'react';
import { Minus, Maximize2, Pentagon, MapPin, Spline, Circle as CircleIcon } from 'lucide-react';

const ToolButton = ({ active, onClick, icon: Icon, label, testid, activeClass = 'bg-qto-primary text-qto-primary-text' }) => (
  <button
    onClick={onClick}
    className={`qto-btn-secondary flex items-center gap-1 text-xs ${active ? activeClass : ''}`}
    data-testid={testid}
  >
    <Icon className="w-3 h-3" /> {label}
  </button>
);

const ToolPalette = ({ mode, setMode, currentPoints, onFinishPolygon, onFinishPolyline }) => {
  const select = (m) => () => { setMode(m); };

  return (
    <div className="mb-4">
      <label className="qto-label">Tools</label>
      <div className="grid grid-cols-2 gap-2">
        <ToolButton active={mode === 'linear'} onClick={select('linear')} icon={Minus} label="Linear" testid="linear-tool" />
        <ToolButton active={mode === 'polyline'} onClick={select('polyline')} icon={Spline} label="Curved" testid="polyline-tool" />
        <ToolButton active={mode === 'rectangle'} onClick={select('rectangle')} icon={Maximize2} label="Rectangle" testid="rectangle-tool" />
        <ToolButton active={mode === 'polygon'} onClick={select('polygon')} icon={Pentagon} label="Polygon" testid="polygon-tool" />
        <ToolButton active={mode === 'circle'} onClick={select('circle')} icon={CircleIcon} label="Circle" testid="circle-tool" />
        <ToolButton active={mode === 'mark'} onClick={select('mark')} icon={MapPin} label="Ref Mark" testid="mark-tool" activeClass="bg-cyan-500 text-white" />
        {mode === 'polygon' && currentPoints.length >= 3 && (
          <button onClick={onFinishPolygon} className="qto-btn col-span-2 text-xs" data-testid="finish-polygon">
            Close Polygon ({currentPoints.length} pts)
          </button>
        )}
        {mode === 'polyline' && currentPoints.length >= 2 && (
          <button onClick={onFinishPolyline} className="qto-btn col-span-2 text-xs" data-testid="finish-polyline">
            Finish Curved ({currentPoints.length} pts)
          </button>
        )}
      </div>
      {mode === 'mark' && (
        <p className="text-xs text-cyan-300 mt-2">Click on the drawing to place a reference mark.</p>
      )}
      {mode === 'circle' && (
        <p className="text-xs text-qto-text-secondary mt-2">
          {currentPoints.length === 0 ? 'Click center of circle' : 'Click any point on the edge'}
        </p>
      )}
      {mode === 'polyline' && (
        <p className="text-xs text-qto-text-secondary mt-2">
          Click points along the curve; click "Finish Curved" when done.
        </p>
      )}
    </div>
  );
};

export default ToolPalette;
