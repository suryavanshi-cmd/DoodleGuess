"use client";

import { MUTED_KEY, readLocal } from "./storage";

export { useMuted, setMuted } from "./storage";

/** Tiny synthesised blips — no audio assets, no autoplay surprises. */
export function ping(kind: "correct" | "close" | "tick" | "end" = "correct") {
  if (readLocal(MUTED_KEY) === "1") return;
  try {
    const AudioCtor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new AudioCtor();
    const notes = { correct: [660, 880], close: [420, 460], tick: [520], end: [520, 392] }[kind];
    notes.forEach((frequency, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.02 + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28 + index * 0.1);
      osc.connect(gain).connect(audio.destination);
      osc.start(audio.currentTime + index * 0.1);
      osc.stop(audio.currentTime + 0.4 + index * 0.1);
    });
    setTimeout(() => void audio.close(), 900);
  } catch {
    // Audio is a nicety, never a requirement.
  }
}
