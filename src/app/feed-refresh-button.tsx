"use client";

import { useState, useTransition } from "react";
import { refreshFeeds } from "./actions";

export default function FeedRefreshButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function refresh() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await refreshFeeds();
        const failureText = result.failures.length ? ` ${result.failures.length} source${result.failures.length === 1 ? "" : "s"} failed.` : "";
        const fallbackText = result.fallbacks ? ` ${result.fallbacks} article${result.fallbacks === 1 ? "" : "s"} need manual text if the feed snippet is incomplete.` : "";
        setMessage(`Added ${result.added} article${result.added === 1 ? "" : "s"}.${fallbackText}${failureText}`);
      } catch (error) {
        setMessage(error instanceof Error ? `Refresh failed: ${error.message}` : "Refresh failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn" type="button" onClick={refresh} disabled={pending}>
        {pending ? "Refreshing feeds…" : "Refresh feeds"}
      </button>
      {message && <p className="max-w-64 text-right text-xs text-muted" role="status">{message}</p>}
    </div>
  );
}
