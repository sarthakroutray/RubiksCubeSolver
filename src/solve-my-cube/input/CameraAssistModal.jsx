'use client';

import { useState, useRef, useEffect } from 'react';
import { NET_FACES, PALETTE } from '../constants.js';

// RGB to HSV conversion
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

// Classify HSV into one of the 6 Rubik's cube colors
// 0: White, 1: Red, 2: Green, 3: Yellow, 4: Orange, 5: Blue
function classifyColor(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);

  // Low saturation or very high brightness with low saturation -> White
  if (s < 0.22 && v > 0.45) return 0;
  if (v > 0.88 && s < 0.28) return 0;

  // Hue ranges:
  // Red: 345 - 360 or 0 - 16
  // Orange: 16 - 44
  // Yellow: 44 - 75
  // Green: 75 - 165
  // Blue: 175 - 265
  if (h >= 345 || h <= 16) return 1;
  if (h > 16 && h <= 44) return 4;
  if (h > 44 && h <= 75) return 3;
  if (h > 75 && h <= 165) return 2;
  if (h > 175 && h <= 265) return 5;

  return 0; // Default fallback to White
}

export default function CameraAssistModal({
  open = false,
  onClose,
  onApplyDetected,
  currentStickers = [],
}) {
  const [activeFaceIdx, setActiveFaceIdx] = useState(0);
  const [streamActive, setStreamActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState(() => {
    const initial = {};
    for (const f of NET_FACES) {
      initial[f.face] = f.slots.map((s) =>
        currentStickers[s] >= 0 ? currentStickers[s] : 0
      );
    }
    return initial;
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentFace = NET_FACES[activeFaceIdx];

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
    } catch (err) {
      alert('Camera access unavailable. You can upload photo files instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (!open) stopCamera();
    return () => stopCamera();
  }, [open]);

  // Sample image and extract 4 quadrants
  const processImage = (imgElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, 200, 200);

    // 4 quadrants: TL, TR, BL, BR
    const quadrants = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 50, y: 150 },
      { x: 150, y: 150 },
    ];

    const detected = quadrants.map((q) => {
      const data = ctx.getImageData(q.x - 10, q.y - 10, 20, 20).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }
      return classifyColor(rSum / count, gSum / count, bSum / count);
    });

    setDetectedFaces((prev) => ({
      ...prev,
      [currentFace.face]: detected,
    }));
  };

  const handleCapture = () => {
    if (videoRef.current) {
      processImage(videoRef.current);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      processImage(img);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleApplyAll = () => {
    const newStickers = [...currentStickers];
    for (const f of NET_FACES) {
      const colors = detectedFaces[f.face];
      if (colors) {
        f.slots.forEach((slot, i) => {
          newStickers[slot] = colors[i];
        });
      }
    }
    onApplyDetected(newStickers);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="smc-modal-overlay" role="dialog" aria-modal="true">
      <div className="smc-modal-card smc-camera-card">
        <div className="smc-camera-header">
          <h3>📷 Photo / Camera Assist</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="smc-camera-desc">
          Capture or upload photos of your cube's 6 faces. Colors are auto-detected and can be reviewed before saving.
        </p>

        {/* Face selector tabs */}
        <div className="smc-face-tabs" role="tablist">
          {NET_FACES.map((f, idx) => (
            <button
              key={f.face}
              type="button"
              className={`smc-face-tab ${activeFaceIdx === idx ? 'active' : ''}`}
              onClick={() => setActiveFaceIdx(idx)}
              role="tab"
              aria-selected={activeFaceIdx === idx}
            >
              Face {f.face} ({f.name})
            </button>
          ))}
        </div>

        {/* Camera / Upload view */}
        <div className="smc-camera-viewport">
          {streamActive ? (
            <div className="smc-video-container">
              <video ref={videoRef} playsInline autoPlay muted className="smc-video" />
              <div className="smc-target-grid">
                <div className="smc-grid-cell" />
                <div className="smc-grid-cell" />
                <div className="smc-grid-cell" />
                <div className="smc-grid-cell" />
              </div>
            </div>
          ) : (
            <div className="smc-camera-placeholder">
              <span>Align face inside grid or upload an image</span>
              <div className="smc-camera-actions">
                <button type="button" className="btn-accent btn-sm" onClick={startCamera}>
                  Start Webcam
                </button>
                <button
                  type="button"
                  className="btn-subtle btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}
        </div>

        {streamActive && (
          <div className="smc-capture-bar">
            <button type="button" className="btn-accent" onClick={handleCapture}>
              📸 Capture Face {currentFace.face}
            </button>
            <button type="button" className="btn-ghost" onClick={stopCamera}>
              Stop Camera
            </button>
          </div>
        )}

        {/* Detected Preview & Manual Review */}
        <div className="smc-review-section">
          <span className="smc-review-title">
            Review Face {currentFace.face} Stickers (Click to edit):
          </span>
          <div className="smc-review-grid">
            {(detectedFaces[currentFace.face] || [0, 0, 0, 0]).map((colId, i) => {
              const pal = PALETTE.find((p) => p.id === colId) || PALETTE[0];
              return (
                <button
                  key={i}
                  type="button"
                  className="smc-review-cell"
                  style={{ '--cell-color': pal.color }}
                  onClick={() => {
                    // Cycle color on click for easy manual correction
                    const nextCol = (colId + 1) % 6;
                    setDetectedFaces((prev) => {
                      const updated = [...(prev[currentFace.face] || [0, 0, 0, 0])];
                      updated[i] = nextCol;
                      return { ...prev, [currentFace.face]: updated };
                    });
                  }}
                  title="Click to cycle color"
                >
                  {pal.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="smc-camera-footer">
          <button type="button" className="btn-accent" onClick={handleApplyAll}>
            ✓ Drop Into Painter for Review
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
