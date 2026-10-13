"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progressive enhancement for the manuscript form: formatting buttons that insert Markdown,
 * an unsaved-changes guard, and an inline preview that uses the same sanitizer as readers get.
 * Without JavaScript the plain textarea and Save button still work.
 */
export function ManuscriptBody({ name, defaultValue, label }: { name: string; defaultValue: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const markDirty = () => setDirty(true);
    const clear = () => setDirty(false);
    form.addEventListener("input", markDirty);
    form.addEventListener("submit", clear);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("submit", clear);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function wrap(before: string, after = before, placeholder = "text") {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const chosen = value.slice(s, e) || placeholder;
    ta.setRangeText(`${before}${chosen}${after}`, s, e, "select");
    ta.focus();
    setDirty(true);
  }

  function linePrefix(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    ta.setRangeText(prefix, start, start, "end");
    ta.focus();
    setDirty(true);
  }

  function addNote() {
    const ta = ref.current;
    if (!ta) return;
    const used = [...ta.value.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
    const n = (used.length ? Math.max(...used) : 0) + 1;
    const pos = ta.selectionEnd;
    const withMarker = `${ta.value.slice(0, pos)}[^${n}]${ta.value.slice(pos)}`;
    ta.value = `${withMarker.replace(/\s*$/, "")}\n\n[^${n}]: Source for note ${n}.`;
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.focus();
    setDirty(true);
  }

  async function showPreview() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyMd: ref.current.value }),
      });
      const data = (await res.json()) as { html?: string };
      setPreview(data.html ?? "<p>Preview unavailable.</p>");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" onClick={() => wrap("*")} aria-label="Italic">Italic</button>
        <button type="button" onClick={() => wrap("**")} aria-label="Bold">Bold</button>
        <button type="button" onClick={() => linePrefix("## ")}>Heading</button>
        <button type="button" onClick={() => linePrefix("> ")}>Quotation</button>
        <button type="button" onClick={() => wrap("[", "](https://)", "link text")}>Link</button>
        <button type="button" onClick={() => wrap(":sc[", "]", "Cal. Educ. Code")}>Small caps</button>
        <button type="button" onClick={addNote}>Note</button>
        <button type="button" onClick={showPreview} disabled={busy}>{busy ? "Rendering…" : "Preview below"}</button>
      </div>
      <textarea ref={ref} id={name} name={name} className="manuscript" defaultValue={defaultValue} aria-describedby={`${name}-hint`} />
      <p className="hint" id={`${name}-hint`}>
        Markdown: *italic*, **bold**, “## ” for a heading, “&gt; ” for a quotation, [^1] for a note with its text on a line starting [^1]:.
      </p>
      <p className="save-state" aria-live="polite">{dirty ? "Unsaved changes" : "No unsaved changes"}</p>
      {preview !== null ? (
        <section className="preview-frame" aria-label="Preview">
          <div className="body" dangerouslySetInnerHTML={{ __html: preview }} />
        </section>
      ) : null}
    </div>
  );
}

/** A submit button that asks for confirmation first (withdraw, unpublish). */
export function ConfirmButton({ label, message, className }: { label: string; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className ?? "button button-danger"}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
