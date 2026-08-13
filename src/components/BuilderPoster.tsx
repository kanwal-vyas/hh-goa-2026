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
  const [sharing, setSharing] = useState<'idle' | 'copied' | 'download' | 'shared'>('idle');

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
   * Share to X. The poster is a real PNG, so the share flow hands that
   * actual file over instead of a link:
   *
   *  1. Phones — the Web Share API opens the native share sheet with the
   *     image attached, so X (and every other app) receives the real
   *     poster, no paste step.
   *  2. Desktop — X's web composer can't receive image files, so we open
   *     the intent with a pre-filled #FrameInGoa caption and copy the PNG
   *     to the clipboard to paste straight into it. If the clipboard API
   *     is unavailable, download the image alongside the open composer.
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
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`;
    const reset = () => window.setTimeout(() => setSharing('idle'), 4000);

    if (blob) {
      const file = new File([blob], `frame-in-goa-${identity.idNumber}.png`, { type: 'image/png' });

      // 1) Native share with the actual image file attached — the mobile path.
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: caption });
          setSharing('shared');
          reset();
          return;
        } catch (err) {
          // dismissed — don't cascade into downloads or new tabs
          if (err instanceof DOMException && err.name === 'AbortError') {
            setSharing('idle');
            return;
          }
          // genuine failure — fall through to the clipboard path
        }
      }

      // 2) Desktop: composer + the PNG on the clipboard, ready to paste.
      let copied = false;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (!copied) {
        await downloadPosterPNG(identity.layout, imgRef.current);
      }
      setSharing(copied ? 'copied' : 'download');
      reset();
    }

    // no shareable image / native share unavailable — still open the
    // composer so the caption isn't lost
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
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
                : sharing === 'shared'
                  ? 'Pick X in the share sheet ✓'
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
