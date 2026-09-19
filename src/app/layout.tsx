import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

/**
 * Three machined faces, all squared-off, each doing one job.
 *
 * Perfect Dark, Ghost Clan, Neuropolitical and Good Times are licensed faces
 * we cannot ship, so these are the closest free matches:
 *
 * - Orbitron: wide geometric display type, the Good Times look, for headings.
 * - Chakra Petch: squared terminals and flat curves — mechanical up close, and
 *   unlike a condensed face it holds its shape in a fast-moving guess feed.
 * - Share Tech Mono: fixed-width HUD readout for the clock, the word rail, room
 *   codes and ranks. Digits line up and never reflow as they count down.
 */
const display = Orbitron({ weight: ["600", "800"], subsets: ["latin"], variable: "--font-display" });
const ui = Chakra_Petch({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-ui" });
const hud = Share_Tech_Mono({ weight: "400", subsets: ["latin"], variable: "--font-hud" });

export const metadata: Metadata = {
  title: "DoodleGuess — draw, guess, laugh",
  description:
    "A fast, friendly multiplayer drawing and guessing game. Make a room, share the code, and play with up to 16 friends.",
};

export const viewport: Viewport = {
  themeColor: "#030b1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/** Applied before paint so the chosen theme never flashes. */
const themeScript = `
  try {
    var stored = localStorage.getItem("doodleguess:theme");
    // An explicit choice always wins. Failing that, follow the system; a
    // system with no opinion gets dark, which is this game's default.
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  document.documentElement.classList.add("js");
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${ui.variable} ${display.variable} ${hud.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
