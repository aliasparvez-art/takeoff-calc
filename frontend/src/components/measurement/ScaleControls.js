import React from 'react';

const ScaleControls = ({
  calibratedSummary, isCalibrating, calibrationLine, knownLength,
  setKnownLength, onStartCalibrate, onApplyCalibration,
}) => (
  <div className="mb-4 p-3 bg-qto-bg rounded-qto" data-testid="scale-status">
    {calibratedSummary ? (
      <>
        <p className="text-xs font-mono text-qto-text-primary">{calibratedSummary}</p>
        <button onClick={onStartCalibrate} className="qto-btn-secondary w-full mt-2 text-xs" data-testid="recalibrate-button">
          Recalibrate
        </button>
      </>
    ) : (
      <>
        <p className="text-xs text-qto-primary font-mono">⚠ Not calibrated</p>
        <button onClick={onStartCalibrate} className="qto-btn w-full mt-2 text-xs" data-testid="set-scale-button">
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
            <input
              type="number" step="0.01" value={knownLength}
              onChange={(e) => setKnownLength(e.target.value)}
              placeholder="Length (m)" className="qto-input w-full text-xs mb-1"
              data-testid="known-length-input"
            />
            <button onClick={onApplyCalibration} className="qto-btn w-full text-xs" data-testid="apply-calibration">
              Apply
            </button>
          </>
        )}
      </div>
    )}
  </div>
);

export default ScaleControls;
