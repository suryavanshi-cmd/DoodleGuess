"use client";

import { ThemeToggle } from "./ThemeToggle";

/**
 * What the room page shows while it is fetching its first state.
 *
 * The front page promises "one tap and the room is open", and then the room
 * page used to answer with a line of grey text on an empty screen for as long
 * as a round trip to the database takes. The gap is real and cannot be
 * removed — but almost none of it needs to be blank.
 *
 * The room code is already known: it is in the URL that was just navigated to.
 * So the one thing somebody wants in that first second — the code, to send to
 * a friend — is on screen immediately, correct, and in its final position.
 * Everything still in flight is a placeholder of the right size, so nothing
 * moves when the real state lands.
 */
export function RoomSkeleton({ code }: { code: string }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6" aria-busy="true">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Doodle<span className="text-brand">Guess</span></h1>
        <ThemeToggle />
      </header>

      <section className="card p-5 text-center">
        <p className="label">Room code</p>
        {/* Real, not a placeholder: it came in with the URL. */}
        <p className="font-mono text-5xl font-black tracking-[0.3em]">{code}</p>
        <p className="mt-4 text-sm text-muted">Opening your room…</p>
      </section>

      <section className="card mt-4 p-4">
        <Bar className="h-5 w-32" />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5">
            <Bar className="size-9 shrink-0 rounded-full" />
            <Bar className="h-4 w-24" />
          </li>
        </ul>
      </section>

      <section className="card mt-4 space-y-3 p-4">
        <Bar className="h-5 w-36" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Bar className="h-16" />
          <Bar className="h-16" />
        </div>
        <Bar className="h-9" />
      </section>

      <span className="sr-only" role="status">Loading room {code}</span>
    </main>
  );
}

/** A placeholder block, sized by the caller to match what will replace it. */
function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block rounded-lg ${className}`} />;
}
