"use client";

/**
 * The arcade HUD strip above the board: clock on the left, the word in the
 * middle, settings on the right.
 *
 * The word is the thing every guesser stares at, so it gets the centre and the
 * widest type. Its length rides as a superscript rather than a separate line
 * of prose — one glance answers "how many letters" without costing a row of
 * height on a phone.
 */

export interface GameHudProps {
  /** Seconds remaining, already resolved against the server clock. */
  seconds: number | null;
  /** 0-1, drives the ring around the clock. Null hides the ring. */
  progress: number | null;
  roundNumber: number;
  totalRounds: number;
  /** "GUESS THIS", "DRAW THIS", "THE WORD WAS" — whatever this moment is. */
  label: string;
  /** Masked, revealed, or the drawer's own word. */
  word: string;
  /** Letter count shown as a superscript; null while there is no word yet. */
  length: number | null;
  onSettings: () => void;
}

export function GameHud({
  seconds, progress, roundNumber, totalRounds, label, word, length, onSettings,
}: GameHudProps) {
  const urgent = seconds !== null && seconds <= 10;

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-2 py-1.5 sm:px-3">
      <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 sm:w-20">
        <Clock seconds={seconds} progress={progress} urgent={urgent} />
        <span className="font-hud text-[11px] leading-none text-muted sm:text-xs">
          {roundNumber}/{totalRounds}
        </span>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <p className="font-hud text-[11px] uppercase leading-none tracking-widest text-muted sm:text-xs">{label}</p>
        <p className="mt-1 truncate font-hud text-xl leading-none tracking-[0.18em] sm:text-3xl" aria-label="The word">
          {word}
          {length !== null ? (
            // A real <sup> flies to the top of a tall pixel line box; nudging a
            // plain span keeps the count beside the word where it reads.
            <span className="ml-0.5 inline-block -translate-y-2 align-baseline text-[11px] text-muted sm:text-sm">
              {length}
            </span>
          ) : null}
        </p>
      </div>

      <button
        type="button"
        onClick={onSettings}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl transition active:scale-90 sm:h-10 sm:w-10"
        aria-label="Room menu"
      >
        ⚙️
      </button>
    </header>
  );
}

/** Ring-and-number clock. The ring is an SVG so it animates on the GPU. */
function Clock({ seconds, progress, urgent }: {
  seconds: number | null;
  progress: number | null;
  urgent: boolean;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const dash = progress === null ? circumference : circumference * Math.max(0, Math.min(1, progress));

  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="3" />
        {progress === null ? null : (
          <circle
            cx="18" cy="18" r={radius} fill="none" strokeWidth="3" strokeLinecap="round"
            stroke={urgent ? "var(--danger)" : "var(--brand)"}
            strokeDasharray={`${dash} ${circumference}`}
            // Matches the 250ms tick that feeds `progress`, so the ring sweeps
            // continuously instead of stepping once a second.
            style={{ transition: "stroke-dasharray 0.25s linear" }}
          />
        )}
      </svg>
      <span className={`font-hud text-sm leading-none sm:text-base ${urgent ? "text-danger" : ""}`}>
        {seconds ?? "–"}
      </span>
    </span>
  );
}
