"use client";

import { LIMITS, type GameMode, type RoomSettings } from "@/lib/game/settings";

const PACKS: { id: RoomSettings["pack"]; label: string; hint: string }[] = [
  { id: "simple", label: "Simple", hint: "Animals, food, objects — great with kids" },
  { id: "tricky", label: "Tricky", hint: "Idioms, abstract ideas, pop culture" },
  { id: "mixed", label: "Mixed", hint: "A bit of both" },
];

function Toggle({ label, hint, checked, disabled, onChange }: {
  label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-[var(--brand)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SettingsForm({ settings, disabled, onChange }: {
  settings: RoomSettings;
  disabled?: boolean;
  onChange: (next: RoomSettings) => void;
}) {
  const patch = (next: Partial<RoomSettings>) => onChange({ ...settings, ...next });

  const MODES: { id: GameMode; label: string; icon: string; hint: string }[] = [
    { id: "draw", label: "Draw it", icon: "🎨", hint: "Sketch the word on the canvas" },
    { id: "text_clue", label: "Clue it", icon: "💬", hint: "Write a cryptic clue — no drawing" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <span className="label">Game mode</span>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {MODES.map((mode) => (
            <button
              key={mode.id} type="button" disabled={disabled}
              onClick={() => patch({ gameMode: mode.id })}
              aria-pressed={settings.gameMode === mode.id}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60
                ${settings.gameMode === mode.id ? "border-brand bg-brand/10" : "border-line bg-surface-2"}`}
            >
              <span className="text-2xl" aria-hidden>{mode.icon}</span>
              <span>
                <span className="block font-semibold">{mode.label}</span>
                <span className="block text-xs text-muted">{mode.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rounds">Rounds: <strong className="text-fg">{settings.rounds}</strong></label>
          <input
            id="rounds" type="range" disabled={disabled}
            min={LIMITS.rounds.min} max={LIMITS.rounds.max} value={settings.rounds}
            onChange={(e) => patch({ rounds: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--brand)]"
          />
        </div>
        <div>
          <label className="label" htmlFor="turn">Seconds per turn: <strong className="text-fg">{settings.turnSeconds}</strong></label>
          <input
            id="turn" type="range" disabled={disabled || settings.hardcore}
            min={LIMITS.turnSeconds.min} max={LIMITS.turnSeconds.max} step={5} value={settings.turnSeconds}
            onChange={(e) => patch({ turnSeconds: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--brand)]"
          />
        </div>
      </div>

      <div>
        <span className="label">Word pack</span>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {PACKS.map((pack) => (
            <button
              key={pack.id} type="button" disabled={disabled}
              onClick={() => patch({ pack: pack.id })}
              aria-pressed={settings.pack === pack.id}
              className={`rounded-xl border p-3 text-left transition disabled:opacity-60
                ${settings.pack === pack.id ? "border-brand bg-brand/10" : "border-line bg-surface-2"}`}
            >
              <span className="block font-semibold">{pack.label}</span>
              <span className="block text-xs text-muted">{pack.hint}</span>
            </button>
          ))}
        </div>
        {settings.pack === "custom" ? (
          <p className="mt-2 text-sm text-muted">Using the room&apos;s custom word pack.</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          label="Letter hints" hint="Reveal a few letters as the clock runs down"
          checked={settings.hintsEnabled} disabled={disabled || settings.hardcore}
          onChange={(hintsEnabled) => patch({ hintsEnabled })}
        />
        <Toggle
          label="Power-ups" hint="Hint reveal, freeze, and a double-points turn"
          checked={settings.powerUpsEnabled} disabled={disabled}
          onChange={(powerUpsEnabled) => patch({ powerUpsEnabled })}
        />
        <Toggle
          label="Hardcore mode" hint="45s turns, no hints — for competitive rooms"
          checked={settings.hardcore} disabled={disabled}
          onChange={(hardcore) => patch({ hardcore })}
        />
        <Toggle
          label="Public room" hint="Listed on the home page so anyone can join"
          checked={settings.isPublic} disabled={disabled}
          onChange={(isPublic) => patch({ isPublic })}
        />
        <Toggle
          label="Strict language filter" hint="Recommended when kids might be playing"
          checked={settings.strictFilter} disabled={disabled}
          onChange={(strictFilter) => patch({ strictFilter })}
        />
      </div>
    </div>
  );
}
