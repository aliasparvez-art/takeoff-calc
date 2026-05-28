import React from 'react';

const SendToBOQPanel = ({
  row, measurements, hasLinear, hasRect, hasPoly, hasPolyline, hasCircle,
  onSendLinearToL, onSendLinearToB, onSendPolylineToL, onSendRectToLB,
  onSendPolyToLB, onSendCircleLinearToL, onSendCircleAreaToLB, onSendAreaToL,
}) => {
  if (!row) return null;
  if (!(hasLinear || hasRect || hasPoly || hasPolyline || hasCircle)) return null;
  const linearLatest = measurements.filter((m) => m.type === 'linear').pop();

  return (
    <div className="mb-3 p-3 bg-qto-bg rounded-qto border border-qto-border" data-testid="send-to-row-panel">
      <label className="qto-label">Send to BOQ Row</label>
      <div className="text-[10px] text-qto-text-secondary font-mono mb-2">
        → {row.item_no} · {row.description?.slice(0, 28)}
      </div>
      {hasLinear && (
        <>
          <button onClick={() => onSendLinearToL(parseFloat(linearLatest.value))} className="qto-btn-secondary w-full text-xs mb-1" data-testid="send-linear-l">
            Linear → L
          </button>
          <button onClick={() => onSendLinearToB(parseFloat(linearLatest.value))} className="qto-btn-secondary w-full text-xs mb-1" data-testid="send-linear-b">
            Linear → B
          </button>
        </>
      )}
      {hasPolyline && (
        <button onClick={onSendPolylineToL} className="qto-btn-secondary w-full text-xs mb-1" data-testid="send-polyline-l">
          Curved length → L
        </button>
      )}
      {hasRect && (
        <button onClick={onSendRectToLB} className="qto-btn w-full text-xs mb-1" data-testid="send-rect-to-lb">
          Rectangle (W × H) → L + B
        </button>
      )}
      {hasPoly && (
        <button onClick={onSendPolyToLB} className="qto-btn w-full text-xs mb-1" data-testid="send-poly-to-lb">
          Polygon √area → L + B
        </button>
      )}
      {hasCircle && (
        <>
          <button onClick={onSendCircleLinearToL} className="qto-btn-secondary w-full text-xs mb-1" data-testid="send-circle-linear-l">
            Circle Linear (C → L)
          </button>
          <button onClick={onSendCircleAreaToLB} className="qto-btn w-full text-xs mb-1" data-testid="send-circle-area-lb">
            Circle Area (r → L, π·r → B)
          </button>
        </>
      )}
      {(hasRect || hasPoly || hasCircle) && (
        <button onClick={onSendAreaToL} className="qto-btn-secondary w-full text-xs" data-testid="send-area-to-l">
          Area value → L (B remains)
        </button>
      )}
    </div>
  );
};

export default SendToBOQPanel;
