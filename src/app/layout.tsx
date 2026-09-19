import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed } from "next/font/google";
import "./globals.css";

/**
 * Fortnite's Burbank Big Condensed is a licensed Adobe face we cannot ship,
 * so this is the closest free pairing: Anton for heavy condensed display type
 * and Barlow Condensed for small, dense UI text.
 */
const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const ui = Barlow_Condensed({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ui",
});

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
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${ui.variable} ${display.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
