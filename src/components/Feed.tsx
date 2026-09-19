"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/lib/game/types";

export type FeedTab = "guesses" | "chat";

const GUESS_KINDS = new Set(["guess", "correct", "close", "synonym", "system", "join", "leave"]);

function entryClass(entry: FeedEntry): string {
  switch (entry.kind) {
    case "correct": return "bg-success/15 text-success font-semibold";
    case "close": return "bg-warning/15 text-warning font-semibold";
    // "Very close" — a listed synonym. Softer than a win, warmer than a miss.
    case "synonym": return "bg-accent/15 text-warning font-semibold ring-1 ring-warning/30";
    case "system": return "text-muted italic";
    case "join": case "leave": return "text-muted";
    default: return "";
  }
}

export function visibleEntries(entries: FeedEntry[], tab: FeedTab): FeedEntry[] {
  return entries.filter((entry) => (tab === "chat" ? entry.kind === "chat" : GUESS_KINDS.has(entry.kind)));
}

export function FeedTabs({ tab, onTab }: { tab: FeedTab; onTab: (tab: FeedTab) => void }) {
  return (
    <div className="flex border-b border-line">
      {(["guesses", "chat"] as FeedTab[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(id)}
          className={`min-h-11 flex-1 px-3 text-sm font-semibold transition
            ${tab === id ? "border-b-2 border-brand text-brand" : "text-muted"}`}
        >
          {id === "guesses" ? "Guesses" : "Room chat"}
        </button>
      ))}
    </div>
  );
}

export function FeedList({ entries, tab }: { entries: FeedEntry[]; tab: FeedTab }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const visible = visibleEntries(entries, tab);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length, tab]);

  return (
    <div ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 text-xs sm:space-y-1 sm:p-2.5 sm:text-sm" aria-live="polite">
      {visible.length === 0 ? (
        <p className="p-2 text-muted">
          {tab === "chat" ? "Banter goes here — it stays out of the guess feed." : "Guesses will show up here."}
        </p>
      ) : null}
      {visible.map((entry) => (
        <p key={entry.id} className={`rounded-md px-1.5 py-0.5 sm:rounded-lg sm:px-2 sm:py-1 ${entryClass(entry)}`}>
          {entry.name && (entry.kind === "chat" || entry.kind === "guess") ? <strong>{entry.name}: </strong> : null}
          {entry.text}
        </p>
      ))}
    </div>
  );
}

export function GuessInput({ tab, onSend, disabled, placeholder, hint, className = "" }: {
  tab: FeedTab;
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
  hint?: string | null;
  className?: string;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  };

  return (
    <div className={className}>
      {hint ? (
        <p className="rounded-t-xl border-x border-t border-warning/40 bg-warning/10 px-3 py-1.5 text-center text-sm font-medium text-warning">
          {hint}
        </p>
      ) : null}
      <div className="flex gap-2">
        <input
          className="input"
          value={text}
          disabled={disabled}
          maxLength={120}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
          aria-label={tab === "chat" ? "Room chat message" : "Your guess"}
        />
        <button type="button" className="btn-primary px-5" onClick={submit} disabled={disabled}>
          {tab === "chat" ? "Send" : "Guess"}
        </button>
      </div>
    </div>
  );
}

/** Desktop sidebar composition: tabs, history and input in one card. */
export function Feed({ entries, tab, onTab, onSend, disabled, placeholder, hint, className = "" }: {
  entries: FeedEntry[];
  tab: FeedTab;
  onTab: (tab: FeedTab) => void;
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
  hint?: string | null;
  className?: string;
}) {
  return (
    <div className={`card flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <FeedTabs tab={tab} onTab={onTab} />
      <FeedList entries={entries} tab={tab} />
      <GuessInput
        tab={tab} onSend={onSend} disabled={disabled} placeholder={placeholder} hint={hint}
        className="border-t border-line p-2.5"
      />
    </div>
  );
}
