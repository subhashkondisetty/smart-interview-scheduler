import React from 'react';

/**
 * Lightweight, zero-dependency SVG / Flex progress bar chart.
 *
 * @param {Object} props
 * @param {Array<{ label: string, value: number, max: number, color: string, subtext?: string }>} props.items
 */
const ProgressBarChart = ({ items = [] }) => {
  return (
    <div className="progress-bar-chart" data-testid="progress-bar-chart">
      {items.map((item, idx) => {
        const value = Number(item.value) || 0;
        const max = Number(item.max) || 100;
        const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

        return (
          <div key={item.label || idx} className="progress-bar-row">
            <div className="progress-bar-header">
              <span className="progress-bar-label">{item.label}</span>
              <span className="progress-bar-value">
                <strong>{value}</strong>
                {item.subtext ? ` ${item.subtext}` : ` / ${max} (${pct}%)`}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || '#4f46e5',
                }}
                data-testid={`progress-fill-${idx}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgressBarChart;
