import type { PublicState } from "@/lib/game/types";

/**
 * Carries the fields only this viewer can see across a state update that does
 * not carry them.
 *
 * Two updates arrive without them. A Realtime broadcast is public by
 * construction — it goes to the whole room, so it cannot contain the drawer's
 * word. And a refresh that races ahead of the stored session is fetched
 * unauthenticated, so the server answers as it would to a stranger. Taking
 * either at face value blanks the drawer's own word mid-turn, which showed up
 * as the word vanishing from the HUD and the AI overlay losing track of what
 * was being drawn.
 *
 * Only within the same round: once the round changes, last turn's word is
 * stale and must go.
 */
export function keepViewerFields(previous: PublicState, incoming: PublicState): PublicState {
  if (!previous.round || previous.round.id !== incoming.round?.id) return incoming;
  return {
    ...incoming,
    yourWord: incoming.yourWord ?? previous.yourWord,
    yourChoices: incoming.yourChoices ?? previous.yourChoices,
    yourCustomWord: incoming.yourCustomWord ?? previous.yourCustomWord,
    hostApproval: incoming.hostApproval ?? previous.hostApproval,
  };
}
