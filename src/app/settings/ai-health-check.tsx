"use client";

import { useState } from "react";
import { checkGeminiAi, checkLocalAi } from "../actions";

export default function AiHealthCheck({ provider = "ollama" }: { provider?: "ollama" | "gemini" }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    const result = provider === "gemini" ? await checkGeminiAi() : await checkLocalAi();
    setStatus(result.ok
      ? `${provider === "gemini" ? "Gemini" : "Local AI"} active · ${result.value.model}`
      : `${provider === "gemini" ? "Gemini" : "Local AI"} offline · ${result.error}`);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn" type="button" onClick={check} disabled={busy}>{busy ? "Checking…" : provider === "gemini" ? "Check Gemini" : "Check Ollama"}</button>
      {status && <p className="text-sm text-muted" role="status">{status}</p>}
    </div>
  );
}
