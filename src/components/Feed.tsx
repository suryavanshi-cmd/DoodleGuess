"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedEntry } from "@/lib/game/types";

export type FeedTab = "guesses" | "chat";

const GUESS_KINDS = new Set(["guess", "correct", "close", "system", "join", "leave"]);

function entryClass(entry: FeedEntry): string {
  switch (entry.kind) {
    case "correct": return "bg-success/15 text-success font-semibold";
    case "close": return "bg-warning/15 text-warning font-semibold";
    case "system": return "text-muted italic";
    case "join": case "leave": return "text-muted";
    default: return "";
  }
}

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
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const visible = entries.filter((entry) => (tab === "chat" ? entry.kind === "chat" : GUESS_KINDS.has(entry.kind)));

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length, tab]);

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  };

  return (
    <div className={`card flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div className="flex border-b border-line">
        {(["guesses", "chat"] as FeedTab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`min-h-11 flex-1 px-3 text-sm font-semibold capitalize transition
              ${tab === id ? "border-b-2 border-brand text-brand" : "text-muted"}`}
          >
            {id === "guesses" ? "Guesses" : "Room chat"}
          </button>
        ))}
      </div>

      <div ref={listRef} className="min-h-40 flex-1 space-y-1 overflow-y-auto p-2.5 text-sm" aria-live="polite">
        {visible.length === 0 ? (
          <p className="p-2 text-muted">
            {tab === "chat" ? "Banter goes here — it stays out of the guess feed." : "Guesses will show up here."}
          </p>
        ) : null}
        {visible.map((entry) => (
          <p key={entry.id} className={`rounded-lg px-2 py-1 ${entryClass(entry)}`}>
            {entry.name && (entry.kind === "chat" || entry.kind === "guess") ? <strong>{entry.name}: </strong> : null}
            {entry.text}
          </p>
        ))}
      </div>

      {hint ? <p className="border-t border-line bg-warning/10 px-3 py-2 text-sm font-medium text-warning">{hint}</p> : null}

      <div className="flex gap-2 border-t border-line p-2.5">
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
        <button type="button" className="btn-primary px-4" onClick={submit} disabled={disabled}>
          {tab === "chat" ? "Send" : "Guess"}
        </button>
      </div>
    </div>
  );
}
