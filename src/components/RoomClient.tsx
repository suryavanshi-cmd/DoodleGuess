"use client";

import { useRouter } from "next/navigation";
import { GameBoard } from "./GameBoard";
import { JoinCard } from "./JoinCard";
import { Lobby } from "./Lobby";
import { Recap } from "./Recap";
import { useRoom } from "@/lib/client/useRoom";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const room = useRoom(code);

  const leave = () => {
    room.actions.leave();
    router.push("/");
  };

  if (room.phase === "error") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>🔍</p>
        <h1 className="mt-3 text-2xl font-bold">Room not found</h1>
        <p className="mt-1 text-muted">{room.error}</p>
        <button type="button" className="btn-primary mt-5" onClick={() => router.push("/")}>Back home</button>
      </main>
    );
  }

  if (room.phase === "loading" || !room.state) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted">Loading room {code}…</p>
      </main>
    );
  }

  if (room.phase === "needs-join") {
    return <JoinCard code={code} onJoin={room.join} />;
  }

  return (
    <>
      {room.notice ? (
        <div className="fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[92vw] rounded-xl bg-fg px-4 py-2 text-center text-sm font-semibold text-bg shadow-lg">
          {room.notice}
        </div>
      ) : null}
      {room.state.status === "lobby" ? <Lobby room={room} onLeave={leave} /> : null}
      {room.state.status === "finished" ? <Recap room={room} onLeave={leave} /> : null}
      {room.state.status !== "lobby" && room.state.status !== "finished"
        ? <GameBoard room={room} onLeave={leave} />
        : null}
    </>
  );
}
