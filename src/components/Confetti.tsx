"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number; vx: number; vy: number; rotation: number; spin: number; color: string; life: number;
}

const COLORS = ["#f97316", "#22c55e", "#6366f1", "#ec4899", "#eab308", "#06b6d4"];

/** A short burst on a correct guess — celebratory, then out of the way. */
export function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    particles.current = Array.from({ length: 70 }, () => ({
      x: rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.5,
      y: rect.height * 0.55,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    }));

    const context = canvas.getContext("2d");
    if (!context) return;

    const step = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        p.life -= 0.012;
        if (p.life <= 0) continue;
        alive = true;
        context.save();
        context.globalAlpha = Math.max(0, p.life);
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-4, -6, 8, 12);
        context.restore();
      }
      if (alive) frame.current = requestAnimationFrame(step);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [trigger]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />;
}
