"use client";

import { useCallback, useEffect, useState } from "react";

/** Safe arithmetic evaluator: tokenize + shunting-yard. No eval(). */
function evaluate(expr: string): number {
  const s = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  if (!s || !/^[0-9+\-*/.()]+$/.test(s)) throw new Error("bad");
  const tokens: (number | string)[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const rawTok = s.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(rawTok)) throw new Error("bad");
      const num = parseFloat(rawTok);
      if (!Number.isFinite(num)) throw new Error("bad");
      tokens.push(num);
      i = j;
    } else if ("+-*/()".includes(c)) {
      // unary minus
      if (c === "-" && (tokens.length === 0 || (typeof tokens[tokens.length - 1] === "string" && tokens[tokens.length - 1] !== ")"))) {
        let j = i + 1;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if (j === i + 1) throw new Error("bad");
        tokens.push(-parseFloat(s.slice(i + 1, j)));
        i = j;
      } else {
        tokens.push(c);
        i++;
      }
    } else throw new Error("bad");
  }
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const out: (number | string)[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (typeof t === "number") out.push(t);
    else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!);
      if (!ops.length) throw new Error("bad");
      ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()!);
      ops.push(t);
    }
  }
  while (ops.length) {
    const o = ops.pop()!;
    if (o === "(") throw new Error("bad");
    out.push(o);
  }
  const stack: number[] = [];
  for (const t of out) {
    if (typeof t === "number") stack.push(t);
    else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("bad");
      stack.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : a / b);
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error("bad");
  return stack[0];
}

const KEYS = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "(", ")", "+", "C", "⌫", "="];

export function Calculator({ onUse }: { onUse: (n: number) => void }) {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const press = useCallback(
    (k: string) => {
      setError(false);
      if (k === "C") {
        setExpr("");
        setResult(null);
        return;
      }
      if (k === "⌫") {
        setResult(null);
        setExpr((e) => e.slice(0, -1));
        return;
      }
      if (k === "=") {
        try {
          const v = evaluate(expr);
          setResult(v);
        } catch {
          setError(true);
          setResult(null);
        }
        return;
      }
      setResult(null);
      setExpr((e) => (e.length > 40 ? e : e + k));
    },
    [expr]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't double-handle keys when typing in a field or activating a button
      // (Enter on a focused key would otherwise both click it and hit "=").
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON")) return;
      if (/^[0-9+\-*/.()]$/.test(e.key)) press(e.key === "*" ? "×" : e.key === "/" ? "÷" : e.key === "-" ? "−" : e.key);
      else if (e.key === "Enter") press("=");
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Escape") setExpr("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div role="group" aria-label="Calculator">
      <div
        aria-live="polite"
        className="numeral"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 26,
          minHeight: 56,
          padding: "6px 12px 12px",
          background: "var(--background)",
          borderRadius: 18,
          marginBottom: 12,
          overflowX: "auto",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {expr || <span style={{ color: "var(--faint)" }}>0</span>}
        {result !== null && !error && (
          <span style={{ color: "var(--coral-deep)" }}> = {Number(result.toFixed(6)).toLocaleString("en-US")}</span>
        )}
        {error && <span style={{ color: "var(--error)", fontSize: 13 }}> — can&apos;t evaluate that</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }} role="presentation">
        {KEYS.map((k) => {
          const isEquals = k === "=";
          const isUtil = k === "C" || k === "⌫";
          return (
            <button
              key={k}
              type="button"
              tabIndex={0}
              onClick={() => press(k)}
              aria-label={k === "⌫" ? "Delete" : k === "=" ? "Equals" : `Key ${k}`}
              style={{
                minHeight: 52,
                borderRadius: 16,
                border: 0,
                background: isEquals ? "var(--coral)" : isUtil ? "var(--surface-secondary)" : "var(--background)",
                color: isEquals ? "#FAF8F3" : "var(--ink)",
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                cursor: "pointer",
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
      {result !== null && !error && Number.isFinite(result) && result > 0 && (
        <button type="button" className="btn-primary" style={{ marginTop: 12, width: "100%" }} onClick={() => onUse(Number(Number(result.toFixed(6))))}>
          Use {Number(result.toFixed(6)).toLocaleString("en-US")}
        </button>
      )}
    </div>
  );
}
