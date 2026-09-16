import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Scale",
  description:
    "Three estimates a day. How close can you get? Scale is a beautifully minimal game about how well you understand the scale of the world.",
  metadataBase: new URL("https://scale.game"),
  openGraph: {
    title: "Scale — a daily game of estimation",
    description: "Three estimates a day. How close can you get?",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
