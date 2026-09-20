import React from 'react';

/**
 * Lightweight, zero-dependency SVG Donut Chart with accessible legend.
 *
 * @param {Object} props
 * @param {Array<{ label: string, value: number, color: string, key: string }>} props.data
 * @param {number} [props.size=220] - Chart dimension in pixels
 * @param {number} [props.strokeWidth=28] - Ring thickness in pixels
 * @param {string} [props.centerLabel='Total'] - Subtitle in center of donut
 * @param {number|string} [props.centerValue] - Value to display in center (defaults to sum of values)
 */
const DonutChart = ({
  data = [],
  size = 220,
  strokeWidth = 28,
  centerLabel = 'Total',
  centerValue,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const displayCenterValue = centerValue !== undefined ? centerValue : total;

  // Build segments with offset calculation
  let accumulatedPercent = 0;
  const segments = data
    .filter((item) => Number(item.value) > 0)
    .map((item) => {
      const itemVal = Number(item.value) || 0;
      const pct = total > 0 ? itemVal / total : 0;
      const strokeDasharray = `${pct * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedPercent * circumference;
      accumulatedPercent += pct;

      return {
        ...item,
        pct: Math.round(pct * 100),
        strokeDasharray,
        strokeDashoffset,
      };
    });

  return (
    <div className="donut-chart-container" data-testid="donut-chart">
      <div className="donut-svg-wrapper" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="donut-svg"
          aria-label={`${centerLabel}: ${displayCenterValue}`}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {total > 0 &&
            segments.map((seg) => (
              <circle
                key={seg.key || seg.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${center} ${center})`}
                className="donut-segment"
                data-testid={`donut-segment-${seg.key || seg.label.toLowerCase()}`}
              />
            ))}
        </svg>

        {/* Center overlay label */}
        <div className="donut-center-content">
          <span className="donut-center-value" data-testid="donut-center-value">
            {displayCenterValue}
          </span>
          <span className="donut-center-label">{centerLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="donut-legend" data-testid="donut-legend">
        {data.map((item) => {
          const itemVal = Number(item.value) || 0;
          const pct = total > 0 ? Math.round((itemVal / total) * 100) : 0;
          return (
            <div
              key={item.key || item.label}
              className="donut-legend-item"
              data-testid={`donut-legend-${item.key || item.label.toLowerCase()}`}
            >
              <div className="legend-marker-row">
                <span className="legend-dot" style={{ backgroundColor: item.color }} />
                <span className="legend-label">{item.label}</span>
              </div>
              <div className="legend-value-row">
                <span className="legend-value">{itemVal}</span>
                <span className="legend-pct">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DonutChart;
