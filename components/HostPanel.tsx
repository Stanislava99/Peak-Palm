"use client";

import { useState } from "react";

export function HostLogin({ needsCode, emailLogin, passwordLogin }: { needsCode: boolean; emailLogin: boolean; passwordLogin: boolean }) {
  const [mode, setMode] = useState<"email" | "password">(emailLogin ? "email" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "email" ? { email } : { password, code }),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
    setBusy(false);
    if (!response.ok) return setError(data.error ?? "That didn’t work.");
    if (mode === "email") setNotice(data.message ?? "Check your inbox.");
    else window.location.reload();
  }

  if (notice) {
    return (
      <div className="host-login">
        <p className="host-ok">{notice}</p>
        <p className="checkout-fine">Open the link on this device. You can close this tab.</p>
      </div>
    );
  }

  return (
    <form className="host-login" onSubmit={submit}>
      {mode === "email" ? (
        <label>
          <span>Your admin email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
      ) : (
        <>
          <label>
            <span>Admin password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {needsCode ? <CodeField value={code} onChange={setCode} /> : null}
        </>
      )}
      {error ? <p className="reserve-error">{error}</p> : null}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Working…" : mode === "email" ? "Email me a sign-in link" : "Sign in"}
      </button>
      {emailLogin && passwordLogin ? (
        <button className="link-button" type="button" onClick={() => setMode(mode === "email" ? "password" : "email")}>
          {mode === "email" ? "Use the password instead" : "Use an email link instead"}
        </button>
      ) : null}
    </form>
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span>6-digit code from your authenticator app</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
      />
    </label>
  );
}

/** Opened from the emailed link. The token stays in the URL fragment, so it never reaches server logs. */
export function VerifyLogin({ needsCode }: { needsCode: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
  let who = "";
  try {
    who = token ? atob(token.split(".")[3].replace(/-/g, "+").replace(/_/g, "/")) : "";
  } catch {
    who = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      history.replaceState(null, "", "/admin/verify");
      window.location.assign("/admin");
      return;
    }
    setBusy(false);
    setError(data.error ?? "That didn’t work.");
  }

  if (!token) {
    return (
      <div className="host-login">
        <p className="reserve-error">This sign-in link is incomplete. Request a new one.</p>
        <a className="button primary" href="/admin">Back to sign in</a>
      </div>
    );
  }

  return (
    <form className="host-login" onSubmit={submit}>
      {who ? <p className="checkout-fine" style={{ textAlign: "left", margin: 0 }}>Signing in as <b>{who}</b></p> : null}
      {needsCode ? <CodeField value={code} onChange={setCode} /> : null}
      {error ? <p className="reserve-error">{error}</p> : null}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in to the admin page"}
      </button>
    </form>
  );
}

export function HostLogout() {
  return (
    <button
      className="button ghost"
      type="button"
      onClick={async () => {
        await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logout: true }) });
        window.location.reload();
      }}
    >
      Log out
    </button>
  );
}

type Action = "accept" | "decline" | "cash-received" | "cash-undo";

export function HostActions({ id, status, balancePaid }: { id: string; status: string; balancePaid: boolean }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function run(action: Action, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; url?: string };
    setBusy(null);
    if (!response.ok || !data.ok) {
      setError(data.error ?? "That didn’t work.");
      return;
    }
    setMessage(data.message ?? "Done.");
    if (data.url) setLink(data.url);
    else window.setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className="host-actions">
      {status === "pending" ? (
        <>
          <button className="button primary" type="button" disabled={Boolean(busy)} onClick={() => run("accept")}>
            {busy === "accept" ? "Confirming…" : "Confirm booking & send confirmation"}
          </button>
          <button
            className="button ghost"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run("decline", "Decline this booking? The guest’s deposit will be refunded in full and they’ll be told by email.")}
          >
            {busy === "decline" ? "Declining…" : "Decline & refund"}
          </button>
        </>
      ) : null}
      {status === "confirmed" && !balancePaid ? (
        <button
          className="button primary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("cash-received", "Mark the balance as received in cash?")}
        >
          {busy === "cash-received" ? "Saving…" : "Balance received in cash"}
        </button>
      ) : null}
      {status === "confirmed" && balancePaid ? (
        <button className="button ghost" type="button" disabled={Boolean(busy)} onClick={() => run("cash-undo", "Undo: mark the balance as not received?")}>
          {busy === "cash-undo" ? "Saving…" : "Undo cash received"}
        </button>
      ) : null}
      {message ? <p className="host-ok">{message}</p> : null}
      {link ? (
        <p className="host-link">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="button ghost" type="button" onClick={() => navigator.clipboard?.writeText(link)}>
            Copy
          </button>
        </p>
      ) : null}
      {error ? <p className="reserve-error">{error}</p> : null}
    </div>
  );
}
