import type { Metadata, Viewport } from "next";
import { Orbitron, Press_Start_2P, Rajdhani } from "next/font/google";
import "./globals.css";

/**
 * Sci-fi HUD pairing. Perfect Dark, Ghost Clan, Neuropolitical and Good Times
 * are all licensed faces we cannot ship, so this is the closest free match:
 * Orbitron for the wide geometric display type (the Good Times look) and
 * Rajdhani for squarish, narrow HUD text that stays legible when compact.
 */
const display = Orbitron({ weight: ["600", "800"], subsets: ["latin"], variable: "--font-display" });
const ui = Rajdhani({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-ui" });
/** Arcade type for the HUD chrome only — timer, round count, the word rail. */
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

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
    var theme = stored || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
  document.documentElement.classList.add("js");
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${ui.variable} ${display.variable} ${pixel.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
