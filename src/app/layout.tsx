import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DoodleGuess — draw, guess, laugh",
  description:
    "A fast, friendly multiplayer drawing and guessing game. Make a room, share the code, and play with up to 16 friends.",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/** Applied before paint so the chosen theme never flashes. */
const themeScript = `
  try {
    var stored = localStorage.getItem("doodleguess:theme");
    var theme = stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geist.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
