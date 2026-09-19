"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals its children once they scroll into view.
 *
 * The class is toggled straight on the element rather than held in state: a
 * page of these would otherwise be a page of re-renders, and nothing else
 * depends on whether a section has appeared yet. Each observer disconnects
 * after firing, so scrolling back up costs nothing.
 *
 * The hidden starting state lives under `html.js` (set by the inline script in
 * the layout, before first paint), so with scripting off every section renders
 * plainly instead of staying invisible forever.
 */
export function Reveal({ children, delay = 0, className = "" }: {
  children: ReactNode;
  /** Stagger, in ms, for items revealed as a group. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      element.classList.add("is-revealed");
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
