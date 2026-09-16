"use client";

import { useEffect, useState } from "react";
import { parseEstimate } from "@/lib/formatting";
import { playTap } from "@/lib/sounds";
import { Calculator } from "./Calculator";

export function EstimateInput({
  unit,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
}: {
  unit: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const parsed = parseEstimate(value);
  const showError = touched && value.trim() !== "" && !parsed.ok;

  useEffect(() => {
    if (!calcOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalcOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calcOpen]);

  return (
    <div>
      <label htmlFor="estimate" className="sr-only">
        Your estimate{unit ? ` in ${unit}` : ""}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id="estimate"
          name="estimate"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className="estimate-field numeral"
          placeholder="Your answer…"
          value={value}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? "estimate-error" : "estimate-hint"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setTouched(true);
              onSubmit();
            }
          }}
          style={unit ? { paddingRight: 72 } : undefined}
        />
        {unit && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 22,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--muted)",
              pointerEvents: "none",
              maxWidth: 56,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginTop: 16,
        }}
      >
        <p id="estimate-hint" style={{ fontSize: 13, color: "var(--faint)", margin: 0 }}>
          {showError ? null : "1.2k · 2.4m · 3b"}
        </p>
        <button
          type="button"
          className="btn-pill"
          aria-expanded={calcOpen}
          aria-haspopup="dialog"
          onClick={() => {
            playTap();
            setCalcOpen(true);
          }}
        >
          Calculator
        </button>
      </div>
      {showError && (
        <p id="estimate-error" role="alert" style={{ fontSize: 13, color: "var(--error)", margin: "10px 0 0" }}>
          {parsed.error}
        </p>
      )}
      {calcOpen && (
        <div className="overlay" onClick={() => setCalcOpen(false)}>
          <div
            className="sheet anim-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Calculator"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" className="btn-pill" autoFocus onClick={() => setCalcOpen(false)}>
                Done
              </button>
            </div>
            <Calculator
              onUse={(n) => {
                onChange(String(n));
                setCalcOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
