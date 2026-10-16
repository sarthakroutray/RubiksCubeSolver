'use client';

const STATS = [
  ['expanded', 'Expanded', '|closed|'],
  ['frontier', 'Frontier', '|open|'],
  ['g', 'Depth', 'g(n)'],
  ['h', 'Heuristic', 'h(n)'],
  ['f', 'Evaluation', 'f(n)'],
  ['bf', 'Branching', 'b*'],
];

function format(key, value) {
  if (key === 'h' || key === 'f') {
    return typeof value === 'number' ? value.toFixed(2) : value;
  }
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

export default function MetricsPanel({ metrics }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Telemetry</span>
        <span className="section-meta">live</span>
      </div>
      <dl className="stats">
        {STATS.map(([key, label, code]) => (
          <div className="stat" key={key}>
            <dt className="stat-label">
              {label}
              <span className="stat-code">{code}</span>
            </dt>
            <dd className="stat-value">{format(key, metrics[key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
