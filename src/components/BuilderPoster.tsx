import { useEffect, useRef, useState } from 'react';
import type { Identity } from '../identity/types';
import { renderPoster, loadPosterFonts, POSTER_W, POSTER_H } from '../identity/renderPoster';
import { downloadPosterPNG, renderPosterBlob } from '../identity/exportPoster';
import './BuilderPoster.css';

interface BuilderPosterProps {
  identity: Identity;
  photoUrl: string | null;
  onReRoll: () => void;
  onEdit: () => void;
}

/**
 * The GENERATED view: the finished Builder ID rendered as a high-res canvas
 * composition (1080 × 1350 design space, scaled to the container). The
 * canvas is drawn imperatively — React renders only the shell. Actions:
 * Download (true PNG export, not a screenshot), Re-roll (new seeded
 * variant), Back to editing.
 */
export function BuilderPoster({ identity, photoUrl, onReRoll, onEdit }: BuilderPosterProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState<'idle' | 'copied' | 'download'>('idle');

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    imgRef.current = img;

    const draw = () => {
      loadPosterFonts().then(() => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;
        const rect = wrap.getBoundingClientRect();
        const cssW = Math.max(1, Math.round(rect.width));
        const cssH = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const bw = Math.round(cssW * dpr);
        const bh = Math.round(cssH * dpr);
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(bw / POSTER_W, 0, 0, bh / POSTER_H, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        renderPoster(ctx, identity.layout, imgRef.current);
        setReady(true);
      });
    };

    if (photoUrl) {
      img.onload = draw;
      img.src = photoUrl;
    } else {
      draw();
    }

    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [identity, photoUrl]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPosterPNG(identity.layout, imgRef.current);
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Share to X: copy the actual PNG to the clipboard (paste it straight
   * into the composer), then open X with a pre-filled #FrameInGoa caption.
   * If the clipboard API is unavailable, fall back to downloading the image
   * alongside the open composer.
   */
  const handleShare = async () => {
    const blob = await renderPosterBlob(identity.layout, imgRef.current);
    const caption = [
      'Just got my Builder ID for Hacker House Goa 2026 \u{1F334}\u26A1',
      '',
      identity.title,
      '',
      '#FrameInGoa',
    ].join('\n');

    let copied = false;
    if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && blob) {
      await downloadPosterPNG(identity.layout, imgRef.current);
    }
    setSharing(copied ? 'copied' : 'download');
    window.setTimeout(() => setSharing('idle'), 4000);

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="poster-stage">
      <div className="poster-eyebrow">
        <span className="pulse" />
        your identity is ready
      </div>

      <div className="poster-column">
        <div className="poster-frame">
          <div ref={wrapRef} className="poster-canvas-wrap">
            <canvas ref={canvasRef} className={`poster-canvas ${ready ? 'is-ready' : ''}`} />
          </div>
          <span className="poster-corner poster-corner--tl" aria-hidden="true" />
          <span className="poster-corner poster-corner--br" aria-hidden="true" />
        </div>

        <div className="poster-meta">
          <span>{identity.title}</span>
          <span className="dot" />
          <span>Builder #{identity.idNumber}</span>
          <span className="dot" />
          <span>#FrameInGoa</span>
        </div>

        <div className="poster-actions">
          <button className="btn-primary" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Printing…' : 'Download Poster ⬇'}
          </button>
          <button className="btn-share" onClick={handleShare}>
            {sharing === 'copied'
              ? 'Image copied — paste into the composer ✓'
              : sharing === 'download'
                ? 'Image downloaded — attach it on X'
                : 'Share to X ✳'}
          </button>
          <button className="btn-ghost" onClick={onReRoll}>
            Re-roll
          </button>
          <button className="btn-ghost" onClick={onEdit}>
            Edit details
          </button>
        </div>
      </div>
    </section>
  );
}
