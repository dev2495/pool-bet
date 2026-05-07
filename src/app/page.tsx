"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((j) => {
        const s = j?.data?.session;
        if (s?.kind === "user") window.location.href = "/play";
        if (s?.kind === "admin") window.location.href = "/admin";
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) {
      setError(json.error || "Could not sign in");
      return;
    }
    window.location.href = "/play";
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 app-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-3xl font-bold tracking-tight">
            <span className="inline-block h-10 w-10 rounded-full bg-gradient-to-br from-[#0a5cc8] to-[#073b83] shadow-sm" />
            Pool&#8209;Bet
          </div>
          <p className="text-muted text-sm mt-2">
            Sign in with your player code. Chips only.
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Your login code</label>
            <input
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="input font-mono uppercase tracking-widest text-center text-lg"
              placeholder="e.g. AB3-9KP"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted mt-1">
              Ask the admin for your code if you don&apos;t have one.
            </p>
          </div>
          {error && <p className="text-loss text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={!code || loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link href="/admin/login" className="text-xs text-muted hover:text-ink">
            Admin sign-in →
          </Link>
        </div>
      </div>
    </main>
  );
}
