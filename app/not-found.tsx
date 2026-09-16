import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingTop: 72, paddingBottom: 80, textAlign: "center" }}>
      <p className="pill" style={{ margin: "0 0 20px" }}>Not found</p>
      <h1 className="display" style={{ fontSize: "clamp(30px, 5vw, 40px)", margin: "0 0 12px" }}>
        That page doesn&rsquo;t exist.
      </h1>
      <p style={{ marginTop: 24 }}>
        <Link href="/" className="btn-pill" style={{ textDecoration: "none" }}>
          Back to Scale
        </Link>
      </p>
    </div>
  );
}
