import '../styles/main.css';

export const metadata = {
  title: 'PocketCube — State Space Search Lab',
  description:
    'Interactive 3D 2×2×2 Pocket Cube visualizer for A*, IDA* and Greedy Best-First heuristic search with live telemetry.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090b10',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
