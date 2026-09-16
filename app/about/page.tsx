import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 72, maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: "clamp(30px, 5vw, 40px)", margin: "0 0 28px", textAlign: "center" }}>
        How scoring works
      </h1>

      <div style={{ display: "grid", gap: 20, fontSize: 15.5, lineHeight: 1.75, color: "var(--ink-soft)" }}>
        <p style={{ margin: 0 }}>
          Three questions a day. Each asks for a quantity in the world — how many,
          how much, how far.
        </p>
        <p style={{ margin: 0 }}>
          Each guess scores a <strong>factor</strong>: how many times too high or
          too low you were. 1× is perfect, 2× means double or half, 10× an order
          of magnitude. Your daily score is the geometric mean of the three.
        </p>
        <p style={{ margin: 0 }}>
          Under 2× is excellent. Under 3× is strong. Above 10×, the world just
          surprised you.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 14, textAlign: "center" }}>
          <Link href="/submit" className="btn-pill" style={{ textDecoration: "none" }}>
            Submit a question →
          </Link>
        </p>
      </div>
    </div>
  );
}
