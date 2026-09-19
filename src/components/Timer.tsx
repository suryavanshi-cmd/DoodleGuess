"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  /** Whole seconds left, or null when nothing is running. */
  seconds: number | null;
  /** 1 at the start of the phase down to 0, or null when nothing is running. */
  progress: number | null;
}

/**
 * One ticking clock for every readout. The device clock is not trusted: the
 * remaining time is measured against the server's own timestamp, so a phone
 * that is minutes out still counts down correctly.
 */
export function useCountdown(endsAt: string | null, serverTime: string, totalSeconds: number): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!endsAt) return { seconds: null, progress: null };
  const skew = Date.parse(serverTime) - now;
  const remainingMs = Math.max(0, Date.parse(endsAt) - (now + skew));
  return {
    seconds: Math.ceil(remainingMs / 1000),
    progress: Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000))),
  };
}

export function Timer({ endsAt, serverTime, totalSeconds }: {
  endsAt: string | null;
  serverTime: string;
  totalSeconds: number;
}) {
  const { seconds, progress } = useCountdown(endsAt, serverTime, totalSeconds);

  if (seconds === null || progress === null) return null;
  const ratio = progress;
  const urgent = seconds <= 10;

  return (
    <div className="flex items-center gap-2" aria-live="off">
      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-surface-2 sm:w-32">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${ratio * 100}%`, background: urgent ? "var(--danger)" : "var(--brand)" }}
        />
      </div>
      <span className={`w-9 text-right font-mono text-lg font-bold ${urgent ? "text-danger" : ""}`}>{seconds}</span>
    </div>
  );
}
