import { useEffect, useRef } from 'react';
import { LiveEnvironment } from '../graphics/LiveEnvironment';
import type { Stage } from '../state/experienceState';
import './LiveBackground.css';

interface LiveBackgroundProps {
  stage: Stage;
  seed?: string | null;
}

/**
 * Mounts the canvas-driven live environment exactly once and hands it
 * coarse stage updates. This component intentionally does NOT hold any
 * per-frame state — React re-renders here happen only on stage/seed change,
 * never on animation ticks. Cursor parallax is applied via direct DOM
 * mutation in a ref callback, also bypassing React's render cycle.
 */
export function LiveBackground({ stage, seed }: LiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const envRef = useRef<LiveEnvironment | null>(null);

  // Mount once.
  useEffect(() => {
    if (!canvasRef.current) return;
    const env = new LiveEnvironment();
    envRef.current = env;
    env.mount(canvasRef.current);
    return () => env.destroy();
  }, []);

  // Coarse stage transitions only — this is the entire React <-> graphics contract.
  useEffect(() => {
    envRef.current?.setStage(stage);
  }, [stage]);

  useEffect(() => {
    if (seed) envRef.current?.setSeed(seed);
  }, [seed]);

  // Restrained cursor parallax on fine pointers only. Direct style writes,
  // not React state, so mouse movement never triggers a re-render.
  useEffect(() => {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const wrapper = wrapperRef.current;
    if (!canHover || !wrapper) return;

    let raf = 0;
    const handleMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // environment responds: sunlight shifts, water bends slightly
        envRef.current?.setPointer(mx, my);
        wrapper.style.setProperty('--parallax-x', `${(mx * 11).toFixed(2)}px`);
        wrapper.style.setProperty('--parallax-y', `${(my * 8).toFixed(2)}px`);
        // paper elements (photo mat) drift a hair, like something on a desk
        document.documentElement.style.setProperty('--pointer-x', mx.toFixed(3));
        document.documentElement.style.setProperty('--pointer-y', my.toFixed(3));
      });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="live-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="live-bg__canvas" />
    </div>
  );
}
