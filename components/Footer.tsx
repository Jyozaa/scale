import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ marginTop: 64 }}>
      <div className="wrap">
        <div
          className="flex items-center justify-between"
          style={{ padding: "28px 4px 44px", fontSize: 13.5, color: "var(--muted)" }}
        >
          <span style={{ fontSize: 13.5 }}>Scale</span>
          <nav className="flex items-center" style={{ gap: 4 }} aria-label="Footer">
            <Link href="/about" className="nav-link" style={{ fontSize: 13.5 }}>
              About
            </Link>
            <Link href="/submit" className="nav-link" style={{ fontSize: 13.5 }}>
              Submit a question
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
