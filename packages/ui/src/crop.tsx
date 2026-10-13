'use client';
// Image crop step of the logo / avatar upload (Figma "DLG — Settings & billing — Logo de l'espace & avatar": RECADRER
// cercle / carré · zoom). The picture covers a square frame; it is dragged to place it (pointer or arrow keys) and zoomed
// 1×–4×. `cropSquare` renders the framed part to a square canvas (no dependency). All copy comes in through props.
import * as React from 'react';
import { cn } from './primitives';

export type CropShape = 'circle' | 'square';
export type CropState = { zoom: number; x: number; y: number };
export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 4;

type Size = { w: number; h: number };
/** Scale and top-left corner of the image inside a `view`-px square frame for a crop state (image always covers the frame). */
export function cropGeometry(img: Size, view: number, s: CropState) {
  const scale = (view / Math.min(img.w, img.h)) * Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, s.zoom));
  const W = img.w * scale;
  const H = img.h * scale;
  const maxX = (W - view) / 2;
  const maxY = (H - view) / 2;
  // `+ 0` turns a clamped -0 into 0
  const x = Math.min(maxX, Math.max(-maxX, s.x)) + 0;
  const y = Math.min(maxY, Math.max(-maxY, s.y)) + 0;
  return { scale, left: (view - W) / 2 + x, top: (view - H) / 2 + y, x, y, W, H };
}

/** The framed square in source pixels: `{ sx, sy, size }`. */
export function cropRect(img: Size, view: number, s: CropState) {
  const g = cropGeometry(img, view, s);
  return { sx: -g.left / g.scale + 0, sy: -g.top / g.scale + 0, size: view / g.scale };
}

/** Draws the framed square of `image` on an `out`×`out` canvas and returns it as a Blob (`type` png / jpeg / webp). */
export function cropSquare(image: HTMLImageElement, view: number, s: CropState, out = 512, type = 'image/png'): Promise<Blob> {
  const r = cropRect({ w: image.naturalWidth, h: image.naturalHeight }, view, s);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, r.sx, r.sy, r.size, r.size, 0, 0, out, out);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), type, 0.92));
}

export function ImageCropper({
  src,
  value,
  onChange,
  shape,
  size = 240,
  label,
  zoomLabel,
  imgRef,
  onLoad,
  className,
}: {
  src: string;
  value: CropState;
  onChange: (next: CropState) => void;
  shape: CropShape;
  /** frame side in px */
  size?: number;
  /** accessible name of the frame ("Recadrer : glissez pour déplacer") */
  label: string;
  zoomLabel: string;
  imgRef?: React.Ref<HTMLImageElement>;
  onLoad?: (img: HTMLImageElement) => void;
  className?: string;
}) {
  const [natural, setNatural] = React.useState<Size | null>(null);
  const drag = React.useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const g = natural ? cropGeometry(natural, size, value) : null;
  const move = (dx: number, dy: number) => onChange({ ...value, x: (g?.x ?? value.x) + dx, y: (g?.y ?? value.y) + dy });
  return (
    <div className={cn('flex flex-col items-center gap-3', className)} data-testid="image-cropper" data-shape={shape}>
      <div
        role="img"
        aria-label={label}
        tabIndex={0}
        className="relative touch-none select-none overflow-hidden rounded-card border border-line-edge bg-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-inbound"
        style={{ width: size, height: size, cursor: 'grab' }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: g?.x ?? value.x, y: g?.y ?? value.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          onChange({ ...value, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 5;
          // physical directions: the picture moves the way the arrow points, in LTR and RTL alike
          const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
          if (!k) return;
          e.preventDefault();
          move(k[0]!, k[1]!);
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            onLoad?.(img);
          }}
          className="pointer-events-none absolute max-w-none"
          style={g ? { width: g.W, height: g.H, left: g.left, top: g.top } : { opacity: 0 }}
        />
        {/* mask outside the kept area */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0', shape === 'circle' ? 'rounded-full' : 'rounded-[2px]')} style={{ boxShadow: '0 0 0 999px rgba(0,0,0,.55)', margin: 2 }} />
      </div>
      <input
        type="range"
        dir="ltr"
        aria-label={zoomLabel}
        min={CROP_ZOOM_MIN}
        max={CROP_ZOOM_MAX}
        step={0.05}
        value={value.zoom}
        onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })}
        className="h-1 w-full max-w-60 cursor-pointer appearance-none rounded-full bg-ink-raised-high accent-white"
        data-testid="crop-zoom"
      />
    </div>
  );
}
