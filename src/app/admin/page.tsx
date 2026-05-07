"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import StatusPill from "@/components/StatusPill";

type Stats = {
  leaderboard: {
    id: string;
    name: string;
    chips: number;
    loginCode: string;
    bets: number;
    wins: number;
    losses: number;
    staked: number;
    returned: number;
    pnl: number;
  }[];
  sessions: {
    id: string;
    name: string;
    status: string;
    rakeBps: number;
    createdAt: string;
    totalPool: number;
    matchCount: number;
    playerCount: number;
  }[];
  totals: {
    users: number;
    chipsInCirculation: number;
    totalBets: number;
    totalStaked: number;
    totalReturned: number;
    houseRake: number;
  };
};

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // session create form
  const [sName, setSName] = useState("");
  const [sRakePct, setSRakePct] = useState("5");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) {
      if (r.status === 403 || r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      setErr(j.error || "Failed to load");
      return;
    }
    setStats(j.data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const rakeBps = Math.round(parseFloat(sRakePct) * 100);
    const r = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: sName, rakeBps }),
    });
    const j = await r.json();
    setCreating(false);
    if (!j.ok) {
      setErr(j.error);
      return;
    }
    window.location.href = `/admin/sessions/${j.data.session.id}`;
  }

  return (
    <div>
      <Nav active="admin" />
      <main className="page-shell app-fade-in">
        {loading && <p className="text-muted">Loading…</p>}
        {err && <p className="text-loss">{err}</p>}

        {stats && (
          <>
            <header className="workspace-head">
              <div>
                <div className="label">Admin control room</div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pool, rake, players, sessions</h1>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Create sessions, monitor chip exposure, and jump into settlement control.
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
                <Link href="/admin/users" className="btn-primary">
                  Player bank
                </Link>
                <Link href="/admin/ledger" className="btn">
                  Global ledger
                </Link>
              </div>
            </header>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Players" value={stats.totals.users} />
              <Stat label="Chips in play" value={stats.totals.chipsInCirculation} />
              <Stat label="Bets placed" value={stats.totals.totalBets} />
              <Stat
                label="House rake ledger"
                value={stats.totals.houseRake}
              />
            </section>

            <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6">
              <div className="card space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Sessions</h3>
                  <span className="text-xs text-muted">Newest first</span>
                </div>
                <form onSubmit={createSession} className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="input sm:col-span-2"
                      placeholder="Session name (e.g. Friday Night)"
                      value={sName}
                      onChange={(e) => setSName(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="input flex-1"
                        type="number"
                        min={0}
                        max={99}
                        step={0.25}
                        placeholder="Rake %"
                        value={sRakePct}
                        onChange={(e) => setSRakePct(e.target.value)}
                      />
                      <span className="text-muted text-xs">%</span>
                    </div>
                  </div>
                  <button className="btn-primary w-full sm:w-auto" disabled={creating || !sName}>
                    {creating ? "Creating…" : "Create session"}
                  </button>
                </form>
                <ul className="space-y-2">
                  {stats.sessions.map((s) => (
                    <li key={s.id} className="ledger-row">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/sessions/${s.id}`}
                          className="font-semibold hover:text-accent flex-1"
                        >
                          {s.name}
                        </Link>
                        <StatusPill status={s.status} />
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
                        <span>{s.matchCount} matches</span>
                        <span>{s.playerCount} players</span>
                        <span>pool {s.totalPool.toLocaleString()}</span>
                        <span>rake {(s.rakeBps / 100).toFixed(2)}%</span>
                      </div>
                    </li>
                  ))}
                  {stats.sessions.length === 0 && (
                    <li className="py-2 text-muted text-sm">No sessions yet.</li>
                  )}
                </ul>
              </div>

              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Players</h3>
                  <Link href="/admin/users" className="text-sm text-accent hover:underline">
                    Manage all →
                  </Link>
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="table min-w-[520px]">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Chips</th>
                      <th>P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leaderboard.slice(0, 8).map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td className="font-mono">{u.loginCode}</td>
                        <td className="chip-num">{u.chips.toLocaleString()}</td>
                        <td
                          className={
                            "chip-num " +
                            (u.pnl > 0 ? "text-win" : u.pnl < 0 ? "text-loss" : "text-muted")
                          }
                        >
                          {u.pnl > 0 ? "+" : ""}
                          {u.pnl.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {stats.leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-2">
                          No players yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                <div className="space-y-2 md:hidden">
                  {stats.leaderboard.slice(0, 8).map((u) => (
                    <div key={u.id} className="ledger-row">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{u.name}</div>
                          <div className="mt-1 font-mono text-xs text-muted">{u.loginCode}</div>
                        </div>
                        <div className="text-right">
                          <div className="kpi-label">Chips</div>
                          <div className="font-mono font-bold">{u.chips.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted">{u.bets} bets</span>
                        <span className={u.pnl > 0 ? "text-win" : u.pnl < 0 ? "text-loss" : "text-muted"}>
                          {u.pnl > 0 ? "+" : ""}
                          {u.pnl.toLocaleString()} P/L
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.leaderboard.length === 0 && (
                    <div className="py-2 text-center text-sm text-muted">No players yet.</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value.toLocaleString()}</div>
    </div>
  );
}
