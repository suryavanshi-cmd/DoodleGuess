"use client";

import { AvatarBadge } from "./AvatarPicker";
import type { useRoom } from "@/lib/client/useRoom";

type Room = ReturnType<typeof useRoom>;

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function Recap({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const { state, me, actions } = room;
  if (!state?.recap) return null;
  const { recap } = state;
  const nameOf = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? "—";
  const playerOf = (id: string) => state.players.find((p) => p.id === id);
  const winner = recap.leaderboard[0];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-center text-3xl font-black">Game over!</h1>
      {winner ? (
        <p className="mt-1 text-center text-lg">
          🏆 <strong>{nameOf(winner.playerId)}</strong> wins with {winner.score} points
        </p>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-3xl" aria-hidden>🎨</p>
          <p className="label">MVP artist</p>
          <p className="text-lg font-bold">{nameOf(recap.mvpArtistId)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl" aria-hidden>⚡</p>
          <p className="label">Fastest guesser</p>
          <p className="text-lg font-bold">{nameOf(recap.fastestGuesserId)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl" aria-hidden>😂</p>
          <p className="label">Most-repeated wrong guess</p>
          <p className="text-lg font-bold">{recap.funniestGuess ? `“${recap.funniestGuess.text}”` : "—"}</p>
        </div>
      </section>

      <section className="card mt-4 overflow-x-auto p-4">
        <h2 className="text-lg font-bold">Session stats</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="pb-2">Player</th>
              <th className="pb-2 text-right">Score</th>
              <th className="pb-2 text-right">Accuracy</th>
              <th className="pb-2 text-right">Avg guess</th>
              <th className="pb-2 text-right">Best streak</th>
            </tr>
          </thead>
          <tbody>
            {recap.leaderboard.map((row) => {
              const stat = recap.stats.find((s) => s.playerId === row.playerId);
              const player = playerOf(row.playerId);
              return (
                <tr key={row.playerId} className="border-t border-line">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      {player ? <AvatarBadge avatar={player.avatar} size={26} /> : null}
                      <span className={row.playerId === me?.id ? "font-bold" : ""}>{player?.name ?? "Player"}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold">{row.score}</td>
                  <td className="py-2 text-right">{stat ? `${stat.accuracy}%` : "—"}</td>
                  <td className="py-2 text-right">{formatMs(stat?.avgGuessMs ?? null)}</td>
                  <td className="py-2 text-right">{stat?.bestStreak ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {me?.isHost ? (
          <button type="button" className="btn-primary flex-1" onClick={() => void actions.start()}>
            Play another game
          </button>
        ) : (
          <p className="flex-1 text-center text-muted sm:self-center">
            The host can start another game — no pressure either way.
          </p>
        )}
        <button type="button" className="btn-ghost flex-1" onClick={onLeave}>Leave room</button>
      </div>
    </main>
  );
}
