import React from 'react';
import { Minus, Maximize2, Pentagon } from 'lucide-react';

const MeasurementToolbar = ({ mode, onModeChange, onFinishPolygon, canFinishPolygon }) => {
  const tools = [
    { id: 'linear', label: 'Linear', icon: Minus, testid: 'linear-tool' },
    { id: 'rectangle', label: 'Rectangle', icon: Maximize2, testid: 'rectangle-tool' },
    { id: 'polygon', label: 'Polygon', icon: Pentagon, testid: 'polygon-tool' },
  ];

  return (
    <div className="mb-6">
      <h4 className="qto-label mb-3">Measurement Tools</h4>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onModeChange(tool.id)}
              className={`qto-btn-secondary flex items-center justify-center gap-2 ${
                mode === tool.id ? 'bg-qto-primary text-qto-primary-text' : ''
              }`}
              data-testid={tool.testid}
            >
              <Icon className="w-4 h-4" />
              {tool.label}
            </button>
          );
        })}
        {mode === 'polygon' && canFinishPolygon && (
          <button onClick={onFinishPolygon} className="qto-btn" data-testid="finish-polygon">
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default MeasurementToolbar;
