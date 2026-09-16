"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { playTap } from "@/lib/sounds";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div
        className="wrap flex items-center justify-between"
        style={{ height: 68, maxWidth: 880 }}
      >
        <Link
          href="/"
          aria-label="Scale home"
          onClick={() => {
            playTap();
            setOpen(false);
          }}
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text)",
          }}
        >
          <BrandMark size={24} />
          <span className="display" style={{ fontSize: 21 }}>
            Scale
          </span>
        </Link>

        {/* Desktop: Archive only */}
        <nav aria-label="Primary" className="hidden sm:flex items-center" style={{ gap: 4 }}>
          <Link
            href="/archive"
            aria-current={pathname === "/archive" ? "page" : undefined}
            className="nav-link"
            onClick={() => playTap()}
            style={
              pathname === "/archive"
                ? { background: "var(--surface-secondary)", color: "var(--text)", fontWeight: 600 }
                : undefined
            }
          >
            Archive
          </Link>
        </nav>

        {/* Mobile: hamburger */}
        <button
          type="button"
          className="sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => {
            playTap();
            setOpen((v) => !v);
          }}
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: 10,
            marginRight: -10,
            color: "var(--text)",
            lineHeight: 0,
          }}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <line x1="5" y1="5" x2="17" y2="17" />
              <line x1="17" y1="5" x2="5" y2="17" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="18" y2="7" />
              <line x1="4" y1="11" x2="18" y2="11" />
              <line x1="4" y1="15" x2="18" y2="15" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="sm:hidden anim-rise"
          style={{
            borderTop: "1px solid var(--line)",
            background: "var(--background)",
            padding: "8px 20px 16px",
          }}
        >
          {[
            { href: "/archive", label: "Archive" },
            { href: "/about", label: "About" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => {
                playTap();
                setOpen(false);
              }}
              style={{
                display: "block",
                textDecoration: "none",
                padding: "12px 4px",
                fontSize: 16,
                fontWeight: 600,
                color: pathname === l.href ? "var(--text)" : "var(--muted)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
