"use client";

import Link from "next/link";
import { playTap } from "@/lib/sounds";

export function PlayButton() {
  return (
    <Link
      href="/play"
      className="btn-primary"
      onClick={() => playTap()}
      style={{ minWidth: 220 }}
    >
      Play today
    </Link>
  );
}
