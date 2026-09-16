"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { parseEstimate } from "@/lib/formatting";
import { saveSubmission } from "@/lib/persistence";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 18,
  boxShadow: "var(--shadow-soft)",
  padding: "14px 16px",
  fontSize: 15,
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
  outline: "none",
  transition: "box-shadow 120ms cubic-bezier(0.22, 1, 0.36, 1)",
};

export default function SubmitPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [unit, setUnit] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (question.trim().length < 12) errs.push("Give the full question, as a player would read it (at least a few words).");
    if (!question.trim().endsWith("?")) errs.push("Phrase the question with a question mark at the end.");
    const p = parseEstimate(answer);
    if (!p.ok) errs.push(p.error ?? "The answer must be a positive number.");
    if (!unit.trim()) errs.push("Name the unit (people, km, litres…).");
    if (reasoning.trim().length < 20) errs.push("Add a sentence or two of reasoning — that's what makes a question good.");
    setErrors(errs);
    if (errs.length > 0) return;
    saveSubmission({ question: question.trim(), answer: answer.trim(), unit: unit.trim(), reasoning: reasoning.trim(), source: source.trim(), name: name.trim() });
    setDone(true);
  }

  if (done) {
    return (
      <div className="wrap" style={{ paddingTop: 72, paddingBottom: 80, textAlign: "center" }}>
        <p className="pill" style={{ margin: "0 0 20px" }}>Submitted</p>
        <h1 className="display" style={{ fontSize: "clamp(28px, 5vw, 38px)", margin: "0 0 12px" }}>
          Thank you. It&rsquo;s on the pile.
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: "46ch", fontSize: 15, margin: "0 auto" }}>
          Saved on this device. Good estimation questions reward reasoning over recall.
        </p>
        <button type="button" className="btn-pill" style={{ marginTop: 24 }} onClick={() => { setDone(false); setQuestion(""); setAnswer(""); setUnit(""); setReasoning(""); setSource(""); setName(""); }}>
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 72, maxWidth: 600 }}>
      <h1 className="display" style={{ fontSize: "clamp(30px, 5vw, 40px)", margin: "0 0 10px", textAlign: "center" }}>
        Stump the estimators.
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: "48ch", margin: "0 auto 32px", textAlign: "center" }}>
        The best questions sound impossible but yield to rough reasoning.
      </p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="sq" className="label" style={{ display: "block", marginBottom: 8 }}>Question</label>
          <textarea id="sq" rows={2} className="soft-input" style={{ ...inputStyle, resize: "vertical" }} placeholder="How many … ?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="sa" className="label" style={{ display: "block", marginBottom: 8 }}>Answer</label>
            <input id="sa" className="soft-input" style={inputStyle} inputMode="decimal" autoComplete="off" placeholder="e.g. 2.4m" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
          <div>
            <label htmlFor="su" className="label" style={{ display: "block", marginBottom: 8 }}>Unit</label>
            <input id="su" className="soft-input" style={inputStyle} autoComplete="off" placeholder="e.g. litres" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="sr" className="label" style={{ display: "block", marginBottom: 8 }}>Reasoning</label>
          <textarea id="sr" rows={3} className="soft-input" style={{ ...inputStyle, resize: "vertical" }} placeholder="Two or three multiplications a player could do…" value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="ss" className="label" style={{ display: "block", marginBottom: 8 }}>Source <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
            <input id="ss" className="soft-input" style={inputStyle} autoComplete="off" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sn" className="label" style={{ display: "block", marginBottom: 8 }}>Name <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
            <input id="sn" className="soft-input" style={inputStyle} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        {errors.length > 0 && (
          <div role="alert" className="surface-card" style={{ padding: "14px 18px" }}>
            {errors.map((er) => (
              <p key={er} style={{ margin: "4px 0", fontSize: 13.5, color: "var(--error)" }}>{er}</p>
            ))}
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ justifySelf: "center", marginTop: 8, minWidth: 220 }}>
          Submit
        </button>
      </form>
    </div>
  );
}
