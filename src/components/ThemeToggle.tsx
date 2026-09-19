"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Reads and writes the theme straight on <html>.
 *
 * No React state anywhere: the attribute swap is the whole switch, so changing
 * theme is a CSS repaint rather than a re-render of every component below it.
 * Both icons are rendered and one is hidden by CSS, which also means the right
 * one is correct in the server-rendered HTML — nothing to hydrate, and no flash
 * of the wrong icon while React catches up.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      // An explicit choice, so it outranks the system preference from now on.
      localStorage.setItem("doodleguess:theme", next);
    } catch {
      // Private mode: the theme still switches, it just will not persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn-ghost px-3 ${className}`}
      aria-label="Switch between light and dark"
    >
      <Moon aria-hidden className="size-[18px] dark:hidden" strokeWidth={2} />
      <Sun aria-hidden className="hidden size-[18px] dark:block" strokeWidth={2} />
    </button>
  );
}
