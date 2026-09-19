"use client";

import { useEffect, useState } from "react";

/**
 * How much of the window the on-screen keyboard is covering, in CSS pixels.
 *
 * The two mobile browsers disagree about keyboards, which is where most of
 * these bugs come from: iOS Safari overlays the keyboard and leaves the layout
 * viewport alone, while Android Chrome shrinks the layout viewport by default
 * and reflows the page under you. The app's viewport meta sets
 * `interactive-widget=overlays-content`, which makes Android behave like iOS —
 * so on both, the layout stays put and `visualViewport` is what tells us the
 * keyboard is there.
 *
 * Returns 0 where there is no visualViewport (older browsers, and every
 * desktop case that matters), which leaves the layout exactly as it was.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // offsetTop matters on iOS, which scrolls the visual viewport up to
      // reveal a focused field rather than resizing anything.
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Small values are browser chrome settling, not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0);
    };

    // Deferred so the first measurement is not a synchronous setState in an
    // effect, and so it lands after the browser has settled the viewport.
    const first = requestAnimationFrame(update);
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      cancelAnimationFrame(first);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
