"use client";
import { useState } from "react";
import Link from "next/link";

export default function AdminLogin() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const j = await res.json();
    setLoading(false);
    if (!j.ok) {
      setErr(j.error || "Login failed");
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 app-fade-in">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <header>
          <div className="label">Admin desk</div>
          <div className="text-xl font-bold tracking-tight">Sign in</div>
          <p className="mt-1 text-xs text-muted">Manage sessions, players, and settlement ledger.</p>
        </header>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            className="input"
            value={p}
            onChange={(e) => setP(e.target.value)}
          />
        </div>
        {err && <p className="text-loss text-sm">{err}</p>}
        <button className="btn-primary w-full" disabled={loading || !u || !p}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-center text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            ← Player sign-in
          </Link>
        </div>
      </form>
    </main>
  );
}
