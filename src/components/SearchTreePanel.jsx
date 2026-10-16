'use client';

const LEGEND = [
  ['closed', 'Closed'],
  ['open', 'Frontier'],
  ['current', 'Exploring'],
  ['solution', 'Solution'],
];

export default function SearchTreePanel({ canvasRef }) {
  return (
    <div className="section section-grow">
      <div className="tree-head">
        <span className="section-title">Expansion tree</span>
        <div className="legend">
          {LEGEND.map(([key, label]) => (
            <span className="legend-item" key={key}>
              <i className={`swatch swatch-${key}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="tree-canvas" />
    </div>
  );
}
