'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import styles from './ImageCropDialog.module.css';

export interface CropSpec {
  /** Width ÷ height of the result. */
  aspect: number;
  /** Largest size sent to the server; smaller sources are never upscaled. */
  width: number;
  height: number;
  shape: 'circle' | 'rect';
}

const MAX_ZOOM = 4;

interface Loaded {
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

/** Crop centre in source pixels, kept inside the image for the current zoom. */
function clampCentre(image: Loaded, spec: CropSpec, zoom: number, x: number, y: number) {
  const { cropWidth, cropHeight } = cropSize(image, spec, zoom);
  return {
    x: Math.min(image.width - cropWidth / 2, Math.max(cropWidth / 2, x)),
    y: Math.min(image.height - cropHeight / 2, Math.max(cropHeight / 2, y)),
  };
}

/** At zoom 1 the crop is the largest box of the right shape that fits the image. */
function cropSize(image: Loaded, spec: CropSpec, zoom: number) {
  const cropWidth = Math.min(image.width, image.height * spec.aspect) / zoom;
  return { cropWidth, cropHeight: cropWidth / spec.aspect };
}

function exportCrop(image: Loaded, spec: CropSpec, zoom: number, centre: { x: number; y: number }): Promise<Blob> {
  const { cropWidth, cropHeight } = cropSize(image, spec, zoom);
  const width = Math.round(Math.min(spec.width, cropWidth));
  const height = Math.round(width / spec.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Canvas unavailable'));
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.element, centre.x - cropWidth / 2, centre.y - cropHeight / 2, cropWidth, cropHeight, 0, 0, width, height);
  // Browsers without a WebP encoder fall back to PNG; the server re-encodes either way.
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/webp', 0.92));
}

/**
 * Drag to position, scroll or slide to zoom, then the visible area is cut in
 * the browser — so what the player frames is exactly what everyone sees.
 * Formats the browser can't draw (HEIC on most desktops) go up uncropped and
 * the server centres them.
 */
export function ImageCropDialog({
  file,
  spec,
  title,
  hint,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  file: File;
  spec: CropSpec;
  title: string;
  hint?: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (image: Blob) => void;
}) {
  const [image, setImage] = useState<Loaded | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      if (!active) return;
      const loaded = { url, width: element.naturalWidth, height: element.naturalHeight, element };
      setImage(loaded);
      setCentre({ x: loaded.width / 2, y: loaded.height / 2 });
    };
    // Revoking the URL on cleanup fails the pending load; only a live load counts.
    element.onerror = () => active && setUnreadable(true);
    element.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [busy, onCancel]);

  /** Source pixels per screen pixel at the current zoom. */
  const sourcePerPixel = () => {
    const box = frame.current?.getBoundingClientRect();
    if (!image || !box) return 1;
    return cropSize(image, spec, zoom).cropWidth / box.width;
  };

  const moveBy = (dx: number, dy: number) => {
    if (!image) return;
    const ratio = sourcePerPixel();
    setCentre((c) => clampCentre(image, spec, zoom, c.x - dx * ratio, c.y - dy * ratio));
  };

  const zoomTo = (next: number) => {
    if (!image) return;
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(value);
    setCentre((c) => clampCentre(image, spec, value, c.x, c.y));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = drag.current;
    if (!last || last.pointerId !== event.pointerId) return;
    moveBy(event.clientX - last.x, event.clientY - last.y);
    drag.current = { ...last, x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => zoomTo(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveBy(...move);
    } else if (event.key === '+' || event.key === '=') zoomTo(zoom + 0.2);
    else if (event.key === '-') zoomTo(zoom - 0.2);
  };

  const confirm = async () => {
    if (unreadable || !image) return onConfirm(file);
    onConfirm(await exportCrop(image, spec, zoom, centre));
  };

  // Position the source inside the frame with percentages, so the preview
  // needs no measuring and survives the dialog resizing.
  let imageStyle: CSSProperties | undefined;
  if (image) {
    const { cropWidth, cropHeight } = cropSize(image, spec, zoom);
    imageStyle = {
      width: `${(image.width / cropWidth) * 100}%`,
      height: `${(image.height / cropHeight) * 100}%`,
      left: `${(0.5 - centre.x / cropWidth) * 100}%`,
      top: `${(0.5 - centre.y / cropHeight) * 100}%`,
    };
  }

  return (
    <div className={styles.overlay} onClick={busy ? undefined : onCancel}>
      <div
        className={cx(styles.dialog, spec.aspect > 1.5 && styles.dialogWide)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id="crop-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onCancel} disabled={busy} aria-label="Cancel">
            <Icon name="close" size={18} />
          </button>
        </header>

        {unreadable ? (
          <p className={styles.fallback}>
            <Icon name="image" size={20} />
            Your browser can&rsquo;t preview this format. It will be uploaded as is and centred automatically.
          </p>
        ) : (
          <div
            ref={frame}
            className={cx(styles.frame, spec.shape === 'circle' && styles.frameCircle)}
            style={{ aspectRatio: String(spec.aspect) }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="application"
            aria-label="Image position. Drag or use the arrow keys to move, plus and minus to zoom."
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            {image ? <img src={image.url} alt="" className={styles.source} style={imageStyle} draggable={false} /> : <span className={styles.loading} />}
            {spec.shape === 'circle' ? <span className={styles.mask} aria-hidden /> : null}
          </div>
        )}

        {!unreadable ? (
          <label className={styles.zoom}>
            <Icon name="image" size={14} />
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(event) => zoomTo(Number(event.target.value))} aria-label="Zoom" disabled={!image} />
            <Icon name="image" size={20} />
          </label>
        ) : null}
        {hint ? <p className={styles.hint}>{hint}</p> : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <footer className={styles.actions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={busy} disabled={!image && !unreadable} icon="check">
            Save
          </Button>
        </footer>
      </div>
    </div>
  );
}
