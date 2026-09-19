import { describe, expect, it } from "vitest";
import { keepViewerFields } from "@/lib/client/mergeState";
import type { PublicState } from "@/lib/game/types";

/**
 * The drawer's word is the one thing in the room state that only one person
 * may see, and the one thing no public update carries. Losing it mid-turn took
 * the word off the drawer's own HUD and left the AI overlay guessing at a word
 * it no longer knew — so this is the merge worth pinning down.
 */
function stateWith(round: { id: string } | null, viewer: Partial<PublicState> = {}): PublicState {
  return {
    round: round ? ({ id: round.id } as PublicState["round"]) : null,
    yourWord: null,
    yourChoices: null,
    yourCustomWord: null,
    hostApproval: null,
    ...viewer,
  } as PublicState;
}

describe("keepViewerFields", () => {
  it("keeps the drawer's word when a public update omits it", () => {
    const previous = stateWith({ id: "r1" }, { yourWord: "cactus" });
    const incoming = stateWith({ id: "r1" });
    expect(keepViewerFields(previous, incoming).yourWord).toBe("cactus");
  });

  it("prefers what the server actually sent", () => {
    const previous = stateWith({ id: "r1" }, { yourWord: "cactus" });
    const incoming = stateWith({ id: "r1" }, { yourWord: "anvil" });
    expect(keepViewerFields(previous, incoming).yourWord).toBe("anvil");
  });

  it("drops last turn's word once the round changes", () => {
    const previous = stateWith({ id: "r1" }, { yourWord: "cactus" });
    const incoming = stateWith({ id: "r2" });
    expect(keepViewerFields(previous, incoming).yourWord).toBeNull();
  });

  it("drops it when the round ends", () => {
    const previous = stateWith({ id: "r1" }, { yourWord: "cactus" });
    expect(keepViewerFields(previous, stateWith(null)).yourWord).toBeNull();
  });

  it("carries the rest of the incoming state through untouched", () => {
    const previous = stateWith({ id: "r1" }, { yourWord: "cactus" });
    const incoming = { ...stateWith({ id: "r1" }), status: "drawing" } as PublicState;
    expect(keepViewerFields(previous, incoming).status).toBe("drawing");
  });
});
