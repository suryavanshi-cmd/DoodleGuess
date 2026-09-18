"use client";

import { useEffect, useState } from "react";

export function Timer({ endsAt, serverTime, totalSeconds }: {
  endsAt: string | null;
  serverTime: string;
  totalSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!endsAt) return null;
  // Trust the server's clock, not the device's.
  const skew = Date.parse(serverTime) - now;
  const remainingMs = Math.max(0, Date.parse(endsAt) - (now + skew));
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000)));
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
