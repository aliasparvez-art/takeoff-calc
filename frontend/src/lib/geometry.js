// Geometry calculation helpers for drawing measurements
export const distancePx = (p1, p2) =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

export const calculateLinear = (p1, p2, scaleFactor) =>
  distancePx(p1, p2) / scaleFactor;

export const calculateRectangle = (p1, p2, scaleFactor) => {
  const width = Math.abs(p2.x - p1.x) / scaleFactor;
  const height = Math.abs(p2.y - p1.y) / scaleFactor;
  return { width, height, area: width * height };
};

export const calculatePolygonArea = (points, scaleFactor) => {
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2) / (scaleFactor * scaleFactor);
};

export const drawMeasurement = (ctx, measurement) => {
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
  } else if (measurement.type === 'polyline') {
    // Curved/polyline: connected segments (does not close)
    ctx.beginPath();
    ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
    for (let i = 1; i < measurement.points.length; i++) {
      ctx.lineTo(measurement.points[i].x, measurement.points[i].y);
    }
    ctx.stroke();
  } else if (measurement.type === 'circle') {
    const [center, edge] = measurement.points;
    const r = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Draw radius line for clarity
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(edge.x, edge.y);
    ctx.stroke();
  }
};

// Sum of segment lengths along a polyline (curved-line proxy).
export const calculatePolylineLength = (points, scaleFactor) => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distancePx(points[i - 1], points[i]);
  }
  return total / scaleFactor;
};

// Circle metrics from center + edge point.
export const calculateCircle = (center, edge, scaleFactor) => {
  const radiusPx = distancePx(center, edge);
  const radius = radiusPx / scaleFactor;
  return {
    radius,
    diameter: radius * 2,
    circumference: 2 * Math.PI * radius,
    area: Math.PI * radius * radius,
  };
};
