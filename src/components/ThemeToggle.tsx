"use client";

/**
 * Reads and writes the theme straight on <html>, with the icon swapped by CSS,
 * so there is no state to hydrate and no flash of the wrong icon.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("doodleguess:theme", next);
    } catch {
      // Theme just will not persist in private mode.
    }
  };

  return (
    <button type="button" onClick={toggle} className={`btn-ghost px-3 ${className}`} aria-label="Toggle dark mode">
      <span aria-hidden className="dark:hidden">🌙</span>
      <span aria-hidden className="hidden dark:inline">☀️</span>
    </button>
  );
}
