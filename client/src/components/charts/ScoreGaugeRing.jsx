import React from 'react';

/**
 * Lightweight SVG circular gauge for percentage scores.
 *
 * @param {Object} props
 * @param {number} props.percentage - Score percentage (0 to 100)
 * @param {number|string} [props.scoreValue] - Raw score / marks (e.g. 74)
 * @param {string} [props.label='Avg Score'] - Subtitle under percentage
 * @param {number} [props.size=160] - Ring diameter
 * @param {number} [props.strokeWidth=16] - Ring thickness
 */
const ScoreGaugeRing = ({
  percentage = 0,
  scoreValue,
  label = 'Avg Score',
  size = 160,
  strokeWidth = 16,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const validPct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const strokeDashoffset = circumference - (validPct / 100) * circumference;

  // Determine color based on threshold
  let strokeColor = '#ef4444'; // Red < 50%
  if (validPct >= 75) {
    strokeColor = '#10b981'; // Green >= 75%
  } else if (validPct >= 50) {
    strokeColor = '#f59e0b'; // Amber 50-74%
  }

  return (
    <div className="gauge-ring-container" data-testid="gauge-ring">
      <div className="gauge-svg-wrapper" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="gauge-svg"
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className="gauge-progress-circle"
            data-testid="gauge-progress-circle"
          />
        </svg>

        <div className="gauge-center-content">
          <span className="gauge-percentage-value" data-testid="gauge-percentage">
            {validPct}%
          </span>
          <span className="gauge-label">{label}</span>
          {scoreValue !== undefined && (
            <span className="gauge-score-value" data-testid="gauge-score-value">
              {scoreValue} pts
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreGaugeRing;
