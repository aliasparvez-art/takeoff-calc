import React from 'react';

const ScaleCalibrationPanel = ({
  scale,
  isCalibrating,
  calibrationLine,
  knownLength,
  onStartCalibration,
  onChangeKnownLength,
  onApplyCalibration,
}) => (
  <div className="mb-6 p-4 bg-qto-bg rounded-qto">
    <h4 className="qto-label mb-3">Scale Calibration</h4>
    <div className="text-xs text-qto-text-secondary mb-3 font-mono">
      Current: {scale.ratio} (1px = {(1 / scale.factor).toFixed(4)}m)
    </div>
    {!isCalibrating ? (
      <button onClick={onStartCalibration} className="qto-btn-secondary w-full" data-testid="start-calibration">
        Calibrate Scale
      </button>
    ) : (
      <div>
        <p className="text-xs text-qto-text-secondary mb-2">
          {!calibrationLine
            ? 'Click to start line'
            : calibrationLine.x2
            ? 'Enter known length'
            : 'Click to end line'}
        </p>
        {calibrationLine?.x2 && (
          <>
            <input
              type="number"
              step="0.01"
              value={knownLength}
              onChange={(e) => onChangeKnownLength(e.target.value)}
              placeholder="Known length (m)"
              className="qto-input w-full mb-2"
              data-testid="known-length-input"
            />
            <button onClick={onApplyCalibration} className="qto-btn w-full" data-testid="apply-calibration">
              Apply
            </button>
          </>
        )}
      </div>
    )}
  </div>
);

export default ScaleCalibrationPanel;
