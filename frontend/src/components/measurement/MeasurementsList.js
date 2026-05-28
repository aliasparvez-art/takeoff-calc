import React from 'react';

const MeasurementsList = ({ measurements }) => (
  <div className="mb-4">
    <label className="qto-label">Captured ({measurements.length})</label>
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {measurements.map((m) => (
        <div key={m.id} className="p-2 bg-qto-bg rounded-qto text-xs">
          <div className="flex justify-between">
            <span className="text-qto-text-secondary capitalize">{m.type}</span>
            <span className="font-mono text-qto-primary font-bold">{m.value} {m.unit}</span>
          </div>
          {m.type === 'rectangle' && m.dimensions && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              W: {m.dimensions.width} m  ×  H: {m.dimensions.height} m
            </div>
          )}
          {m.type === 'polygon' && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              √area side: {Math.sqrt(parseFloat(m.value)).toFixed(3)} m
            </div>
          )}
          {m.type === 'circle' && m.dimensions && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              r: {m.dimensions.radius} m  ·  Ø: {m.dimensions.diameter} m  ·  C: {m.dimensions.circumference} m
            </div>
          )}
          {m.type === 'polyline' && (
            <div className="text-[10px] text-qto-text-secondary font-mono mt-1">
              {m.points.length} pts along curve
            </div>
          )}
        </div>
      ))}
      {measurements.length === 0 && <p className="text-xs text-qto-text-secondary">No measurements yet</p>}
    </div>
  </div>
);

export default MeasurementsList;
