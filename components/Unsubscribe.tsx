"use client";

import { useState } from "react";

/** On /unsubscribe: one button, so link scanners in mail apps can't unsubscribe anyone by opening the link. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") return <p className="host-ok">You’re unsubscribed. You won’t get offers from us any more. Booking emails for a stay you’ve paid for still arrive.</p>;
  return (
    <div className="host-login">
      <button
        className="button primary"
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          setError(null);
          const response = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (response.ok) setState("done");
          else {
            setState("idle");
            setError(data.error ?? "That didn’t work. Please try again.");
          }
        }}
      >
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe from offers"}
      </button>
      {error ? <p className="reserve-error">{error}</p> : null}
    </div>
  );
}

/** In the admin side panel: stop offers to this guest. */
export function RemoveFromOffers({ email, refId }: { email: string; refId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") return <span className="host-ok">Removed from offers.</span>;
  return (
    <>
      <button
        className="link-button"
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          if (!window.confirm(`Stop sending offers to ${email}?`)) return;
          setState("busy");
          const response = await fetch("/api/admin/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ref: refId }) });
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (response.ok) setState("done");
          else {
            setState("idle");
            setError(data.error ?? "That didn’t work.");
          }
        }}
      >
        {state === "busy" ? "Removing…" : "Remove from offers"}
      </button>
      {error ? <span className="reserve-error"> {error}</span> : null}
    </>
  );
}
