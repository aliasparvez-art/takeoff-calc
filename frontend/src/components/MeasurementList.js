import React from 'react';

const MeasurementList = ({ measurements }) => (
  <div className="mb-6">
    <h4 className="qto-label mb-3">Captured Measurements</h4>
    <div className="space-y-2">
      {measurements.map((m) => (
        <div key={m.id} className="p-2 bg-qto-bg rounded-qto text-sm">
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
);

export default MeasurementList;
