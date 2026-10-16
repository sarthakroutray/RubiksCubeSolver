'use client';

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 16, children, strokeWidth, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      strokeWidth={strokeWidth ?? base.strokeWidth}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function CubeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
      <line x1="7.5" y1="4.5" x2="16.5" y2="9.5" />
    </Svg>
  );
}

export function ResetIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  );
}

export function KeyboardIcon(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </Svg>
  );
}

export function PlayIcon({ size = 16, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function StopIcon({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function CopyIcon(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function ChevronIcon(props) {
  return (
    <Svg strokeWidth={2.5} {...props}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

export function CloseIcon(props) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function RefreshCamIcon(props) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </Svg>
  );
}
