import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { env } from "@/config/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: {
    default: "Articles",
    template: "%s | Articles",
  },
  description: "Articles from our publishing platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        <header className="site-header">
          <nav className="container site-nav">
            {/* "/" is not migrated yet, so it is a plain link to the legacy home page. */}
            <a href="/" className="brand">
              Publishing Platform
            </a>
            <Link href="/articles" className="subtle-link">
              Articles
            </Link>
          </nav>
        </header>
        <main className="container site-main">{children}</main>
        <footer className="site-footer muted">Content served from the legacy system of record.</footer>
      </body>
    </html>
  );
}
