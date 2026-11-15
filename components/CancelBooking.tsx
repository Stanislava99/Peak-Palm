"use client";

import { useState } from "react";

/** On /cancel: a deliberate two-step button, so mail apps that open links can't cancel anything. */
export function CancelButton({ token, refund }: { token: string; refund: string }) {
  const [state, setState] = useState<"idle" | "sure" | "busy" | "done" | "late">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p className="host-ok cancel-done">
        Your booking is cancelled. {refund} is being refunded to your card, and we’ve sent you a confirmation email.
      </p>
    );
  }
  if (state === "late") return <p className="reserve-error">The free cancellation period has just ended, so this booking can’t be cancelled online.</p>;

  return (
    <div className="cancel-actions">
      {state === "idle" ? (
        <button className="button primary cancel-go" type="button" onClick={() => setState("sure")}>
          Cancel my booking
        </button>
      ) : (
        <>
          <p className="cancel-sure">Are you sure? This can’t be undone, and the dates become available to other guests.</p>
          <div className="cancel-buttons">
            <button
              className="button primary cancel-go"
              type="button"
              disabled={state === "busy"}
              onClick={async () => {
                setState("busy");
                setError(null);
                const response = await fetch("/api/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
                const data = (await response.json().catch(() => ({}))) as { error?: string; expired?: boolean };
                if (response.ok) setState("done");
                else if (data.expired) setState("late");
                else {
                  setState("sure");
                  setError(data.error ?? "That didn’t work. Please try again.");
                }
              }}
            >
              {state === "busy" ? "Cancelling…" : `Yes, cancel and refund ${refund}`}
            </button>
            <button className="button ghost" type="button" disabled={state === "busy"} onClick={() => setState("idle")}>
              Keep my booking
            </button>
          </div>
        </>
      )}
      {error ? <p className="reserve-error">{error}</p> : null}
    </div>
  );
}
