import type { Metadata } from "next";
import "./globals.css";
import "./voter.css";
import "./living-brief.css";

export const metadata: Metadata = {
  title: "Campaign Weather",
  description:
    "AI-assisted civic evidence infrastructure for live election coverage.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
