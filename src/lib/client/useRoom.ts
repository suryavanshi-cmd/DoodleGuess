"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { joinRoomChannel, realtimeEnabled, type RoomChannel } from "./realtime";
import { clearSession, readSession, saveSession, useStoredSession, type Session } from "./storage";
import type { Avatar, FeedEntry, PublicState, RealtimeEvent, Stroke } from "@/lib/game/types";

export type RoomPhase = "loading" | "needs-join" | "ready" | "error";

export interface FloatingReaction {
  id: string;
  emoji: string;
  playerId: string;
  x: number;
}

const LIVE_POLL_MS = 4_000;
const FALLBACK_POLL_MS = 1_000;
const STROKE_POLL_MS = 900;
const FREEZE_MS = 5_000;

/**
 * Snapshots race: a poll issued before an action completes can land after it.
 * Returns true when this snapshot is older than one already applied, and
 * records it otherwise.
 */
function isStale(next: PublicState, last: { current: number }): boolean {
  const at = Date.parse(next.serverTime);
  if (!Number.isFinite(at)) return false;
  if (at < last.current) return true;
  last.current = at;
  return false;
}

function mergeFeed(previous: FeedEntry[], incoming: FeedEntry[]): FeedEntry[] {
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-80);
}

export function useRoom(code: string) {
  const storedSession = useStoredSession(code);
  const [state, setState] = useState<PublicState | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [frozen, setFrozen] = useState(false);
  // Assume no live channel until one actually subscribes.
  const [live, setLive] = useState(false);

  const channelRef = useRef<RoomChannel | null>(null);
  const sessionRef = useRef<Session | null>(storedSession);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundIdRef = useRef<string | null>(null);
  /** Server clock of the newest snapshot applied, to drop out-of-order ones. */
  const lastSnapshotRef = useRef(0);

  useEffect(() => {
    sessionRef.current = storedSession;
  }, [storedSession]);

  const session = storedSession;
  const me = useMemo(
    () => state?.players.find((p) => p.id === session?.playerId) ?? null,
    [state, session],
  );
  const isDrawer = Boolean(state?.round && session && state.round.drawerId === session.playerId);

  const phase: RoomPhase = error
    ? "error"
    : !state
      ? "loading"
      : session && state.players.some((p) => p.id === session.playerId)
        ? "ready"
        : "needs-join";

  const refresh = useCallback(async () => {
    try {
      const next = await api.state(code, sessionRef.current ?? readSession(code));
      if (!isStale(next, lastSnapshotRef)) {
        setState(next);
        setFeed((previous) => mergeFeed(previous, next.feed));
      }
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("No room with that code. Check the letters and try again.");
      }
      return null;
    }
  }, [code]);

  /** Coalesce authenticated refetches so a burst of events costs one request. */
  const scheduleRefresh = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void refresh();
    }, 350);
  }, [refresh]);

  const onEvent = useCallback((event: RealtimeEvent) => {
    const meId = sessionRef.current?.playerId ?? null;
    switch (event.type) {
      case "state":
        if (!isStale(event.state, lastSnapshotRef)) {
          setState((previous) => (previous
            // A broadcast is built for the whole room, so it never carries the
            // drawer's own word: keep what we already know.
            ? { ...event.state, yourWord: previous.yourWord, yourChoices: previous.yourChoices }
            : event.state));
          setFeed((previous) => mergeFeed(previous, event.state.feed));
        }
        scheduleRefresh();
        break;
      case "feed":
        setFeed((previous) => mergeFeed(previous, [event.entry]));
        break;
      case "stroke":
        if (event.playerId === meId) break;
        setStrokes((previous) => [...previous, event.stroke]);
        break;
      case "canvas":
        if (event.playerId === meId) break;
        setStrokes(event.action === "clear" ? [] : event.strokes ?? []);
        break;
      case "reaction": {
        const id = `${event.playerId}-${event.at}-${Math.random().toString(36).slice(2, 7)}`;
        setReactions((previous) => [
          ...previous.slice(-12),
          { id, emoji: event.emoji, playerId: event.playerId, x: 10 + Math.random() * 80 },
        ]);
        setTimeout(() => setReactions((previous) => previous.filter((r) => r.id !== id)), 2_200);
        break;
      }
      case "freeze":
        if (event.targetId === meId) {
          setFrozen(true);
          setNotice(`🧊 ${event.byName} froze you for 5 seconds!`);
          setTimeout(() => { setFrozen(false); setNotice(null); }, FREEZE_MS);
        }
        break;
    }
  }, [scheduleRefresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = joinRoomChannel(code, onEvent, (status) => setLive(status === "connected"));
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
      setLive(false);
    };
  }, [code, onEvent]);

  useEffect(() => {
    const interval = setInterval(() => { void refresh(); }, live ? LIVE_POLL_MS : FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh, live]);

  // Strokes: fresh canvas each turn, then live events (or polling without Realtime).
  const currentRoundId = state?.round?.id ?? null;
  useEffect(() => {
    if (roundIdRef.current === currentRoundId) return;
    roundIdRef.current = currentRoundId;
    setStrokes([]);
    if (!currentRoundId) return;
    void api.strokes(currentRoundId)
      .then(({ strokes: saved }) => {
        if (saved.length) setStrokes((previous) => (previous.length ? previous : saved));
      })
      .catch(() => undefined);
  }, [currentRoundId]);

  useEffect(() => {
    if (live || isDrawer || !currentRoundId) return;
    const interval = setInterval(() => {
      void api.strokes(currentRoundId)
        .then(({ strokes: saved }) => setStrokes(saved))
        .catch(() => undefined);
    }, STROKE_POLL_MS);
    return () => clearInterval(interval);
  }, [currentRoundId, isDrawer, live]);

  const join = useCallback(async (name: string, avatar: Avatar) => {
    const saved = readSession(code);
    const result = await api.join(code, { name, avatar, token: saved?.token ?? null });
    const next: Session = { playerId: result.playerId, token: result.token };
    sessionRef.current = next;
    saveSession(code, next);
    await refresh();
  }, [code, refresh]);

  const withSession = useCallback(<T,>(fn: (session: Session) => Promise<T>) => async (): Promise<T | null> => {
    const current = sessionRef.current ?? readSession(code);
    if (!current) return null;
    try {
      return await fn(current);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That did not work — try again.");
      setTimeout(() => setNotice(null), 3_500);
      return null;
    }
  }, [code]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistStrokes = useCallback((next: Stroke[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const current = sessionRef.current;
      if (current) void api.saveStrokes(code, current, next).catch(() => undefined);
    }, 700);
  }, [code]);

  const actions = useMemo(() => ({
    start: () => withSession((s) => api.start(code, s))(),
    updateSettings: (settings: unknown) => withSession((s) => api.settings(code, s, settings))()
      .then(() => { void refresh(); }),
    choose: (roundId: string, index: number) => withSession((s) => api.choose(code, s, roundId, index))()
      .then((next) => {
        if (next && !isStale(next, lastSnapshotRef)) {
          setState(next);
          setFeed((previous) => mergeFeed(previous, next.feed));
        }
      }),
    guess: (text: string) => withSession((s) => api.guess(code, s, text))(),
    submitCustomWord: (roundId: string, word: string, save: boolean) =>
      withSession((s) => api.customWord(code, s, roundId, word, save))().then((result) => {
        if (result && !isStale(result.state, lastSnapshotRef)) {
          setState(result.state);
          setFeed((previous) => mergeFeed(previous, result.state.feed));
        }
        return result;
      }),
    resolveCustomWord: (roundId: string, approve: boolean) =>
      withSession((s) => api.resolveCustomWord(code, s, roundId, approve))().then((next) => {
        if (next && !isStale(next, lastSnapshotRef)) {
          setState(next);
          setFeed((previous) => mergeFeed(previous, next.feed));
        }
      }),
    myWords: (word?: string) => withSession((s) => api.myWords(code, s, word))(),
    submitClue: (roundId: string, text: string) =>
      withSession((s) => api.clue(code, s, roundId, text))().then((next) => {
        if (next && !isStale(next, lastSnapshotRef)) {
          setState(next);
          setFeed((previous) => mergeFeed(previous, next.feed));
        }
        return next;
      }),
    clueSuggestions: (roundId: string) => withSession((s) => api.clueSuggestions(code, s, roundId))(),
    chat: (text: string) => withSession((s) => api.chat(code, s, text))().then(() => { void refresh(); }),
    powerUp: (kind: "hint" | "freeze", targetId?: string) =>
      withSession((s) => api.powerUp(code, s, kind, targetId))().then((result) => {
        void refresh();
        return result;
      }),
    react: (emoji: string) => {
      channelRef.current?.send({
        type: "reaction", playerId: sessionRef.current?.playerId ?? "", emoji, at: Date.now(),
      });
      return withSession((s) => api.reaction(code, s, emoji))();
    },
    uploadPack: (name: string, words: string) => withSession((s) => api.wordPack(code, s, name, words))()
      .then((result) => { void refresh(); return result; }),
    leave: () => {
      const current = sessionRef.current;
      if (current) void api.leave(code, current).catch(() => undefined);
      clearSession(code);
    },
  }), [code, refresh, withSession]);

  /** Drawer-side canvas plumbing: broadcast now, persist for replay shortly after. */
  const pushStroke = useCallback((stroke: Stroke, all: Stroke[]) => {
    setStrokes(all);
    channelRef.current?.send({ type: "stroke", playerId: sessionRef.current?.playerId ?? "", stroke });
    persistStrokes(all);
  }, [persistStrokes]);

  const pushCanvas = useCallback((action: "clear" | "undo" | "redo", all: Stroke[]) => {
    setStrokes(all);
    channelRef.current?.send({
      type: "canvas", playerId: sessionRef.current?.playerId ?? "", action, strokes: all,
    });
    persistStrokes(all);
  }, [persistStrokes]);

  return {
    phase, error, notice, state, feed, me, isDrawer, session, frozen,
    strokes, reactions, join, actions, pushStroke, pushCanvas, refresh,
    liveMode: realtimeEnabled(),
  };
}
