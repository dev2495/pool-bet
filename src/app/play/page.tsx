"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import StatusPill from "@/components/StatusPill";

type Outcome = {
  id: string;
  label: string;
  poolChips: number | null;
  betCount: number | null;
  oddsDecimal: number | null;
  share: number | null;
};
type Match = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  winningOutcomeId: string | null;
  betCount: number;
  totalPool: number | null;
  outcomes: Outcome[];
  myBets: { outcomeId: string; stake: number }[];
};
type Sess = {
  id: string;
  name: string;
  status: string;
  rakeBps: number;
  matches: Match[];
};

export default function PlayPage() {
  const [me, setMe] = useState<{ id: string; name: string; chips: number } | null>(null);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [picking, setPicking] = useState<{ matchId: string; outcomeId: string } | null>(null);
  const [stake, setStake] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  async function refresh() {
    const r = await fetch("/api/feed", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) {
      if (r.status === 401) window.location.href = "/";
      return;
    }
    setMe(j.data.me);
    setSessions(j.data.sessions);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, []);

  async function placeBet() {
    if (!picking || stake <= 0) return;
    setPlacing(true);
    setError(null);
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: picking.matchId, outcomeId: picking.outcomeId, stake }),
    });
    const j = await res.json();
    setPlacing(false);
    if (!j.ok) {
      setError(j.error || "Could not place bet");
      return;
    }
    setPicking(null);
    setStake(0);
    refresh();
  }

  return (
    <div>
      <Nav active="play" />
      <main className="page-shell app-fade-in">
        {loading && <p className="text-muted">Loading…</p>}
        {!loading && sessions.length === 0 && (
          <div className="card text-center text-muted">
            No active sessions yet. Wait for the admin to open one.
          </div>
        )}

        {!loading && me && (
          <header className="workspace-head">
            <div>
              <div className="label">Player board</div>
              <h1 className="text-2xl font-bold tracking-tight">Live pools</h1>
              <p className="mt-1 text-sm text-muted">
                {me.name} · balance{" "}
                <span className="font-mono text-ink">{me.chips.toLocaleString()}</span> chips.
                Odds update as players add to the pool.
              </p>
            </div>
            <div className="rounded-md border border-line bg-panel2 px-3 py-2 text-right">
              <div className="kpi-label">Open sessions</div>
              <div className="text-2xl font-bold tabular-nums">{sessions.length}</div>
            </div>
          </header>
        )}

        {sessions.map((s) => (
          <section key={s.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">{s.name}</h2>
              <StatusPill status={s.status} />
              <span className="text-xs text-muted">Rake: {(s.rakeBps / 100).toFixed(2)}%</span>
              {s.status === "OPEN" && (
                <span className="text-xs text-warn">
                  · odds hidden — place blind bets, odds reveal when admin starts the round
                </span>
              )}
            </div>

            {s.matches.length === 0 && <p className="text-muted text-sm">No matches yet.</p>}

            <div className="grid lg:grid-cols-2 gap-3">
              {s.matches.map((m) => (
                <article key={m.id} className="card space-y-3">
                  <header className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{m.name}</div>
                      {m.description && (
                        <div className="text-xs text-muted">{m.description}</div>
                      )}
                    </div>
                    <StatusPill status={m.status} />
                  </header>

                  <div className="space-y-2">
                    {m.outcomes.map((o) => {
                      const myStake = m.myBets
                        .filter((b) => b.outcomeId === o.id)
                        .reduce((s, b) => s + b.stake, 0);
                      const winnerHere = m.winningOutcomeId === o.id;
                      const canBet =
                        m.status === "OPEN" && (s.status === "OPEN" || s.status === "LIVE");
                      return (
                        <button
                          key={o.id}
                          onClick={() =>
                            canBet ? setPicking({ matchId: m.id, outcomeId: o.id }) : null
                          }
                          disabled={!canBet}
                          className={
                            "w-full text-left rounded-md border px-3 py-2.5 transition " +
                            (winnerHere
                              ? "border-win/60 bg-win/10"
                              : canBet
                              ? "border-line bg-panel2 hover:border-accent/70 hover:bg-accent/5"
                              : "border-line bg-panel2 opacity-70 cursor-not-allowed")
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{o.label}</div>
                              {myStake > 0 && (
                                <div className="text-xs text-accent">
                                  You: {myStake.toLocaleString()} chips
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {o.oddsDecimal != null ? (
                                <div className="font-mono tabular-nums text-lg font-bold">
                                  ×{o.oddsDecimal.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-muted text-xs">
                                  {o.poolChips == null ? "odds hidden" : "no bets"}
                                </div>
                              )}
                              {o.poolChips != null && (
                                <div className="text-[10px] text-muted">
                                  pool {o.poolChips.toLocaleString()} · {o.betCount} bet
                                  {o.betCount === 1 ? "" : "s"}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <footer className="flex items-center justify-between text-xs text-muted">
                    <span>{m.betCount} bets total</span>
                    {m.totalPool != null && (
                      <span>pool {m.totalPool.toLocaleString()} chips</span>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {picking && (
        <BetModal
          onClose={() => setPicking(null)}
          stake={stake}
          setStake={setStake}
          chips={me?.chips || 0}
          onPlace={placeBet}
          placing={placing}
          error={error}
          context={(() => {
            for (const s of sessions)
              for (const m of s.matches)
                if (m.id === picking.matchId) {
                  const o = m.outcomes.find((x) => x.id === picking.outcomeId);
                  return {
                    match: m.name,
                    outcome: o?.label || "?",
                    odds: o?.oddsDecimal ?? null,
                  };
                }
            return null;
          })()}
        />
      )}
    </div>
  );
}

function BetModal({
  onClose,
  stake,
  setStake,
  chips,
  onPlace,
  placing,
  error,
  context,
}: {
  onClose: () => void;
  stake: number;
  setStake: (n: number) => void;
  chips: number;
  onPlace: () => void;
  placing: boolean;
  error: string | null;
  context: { match: string; outcome: string; odds: number | null } | null;
}) {
  const projected =
    context?.odds && stake > 0 ? Math.floor(stake * context.odds) : null;
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-bg/80 backdrop-blur p-4" onClick={onClose}>
      <div className="card max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <header>
          <div className="text-xs text-muted">Place bet</div>
          {context && (
            <div className="font-medium">
              {context.match} → <span className="text-accent">{context.outcome}</span>
            </div>
          )}
        </header>
        <div>
          <label className="label">Stake (chips)</label>
          <input
            autoFocus
            type="number"
            min={1}
            max={chips}
            className="input"
            value={stake || ""}
            onChange={(e) => setStake(parseInt(e.target.value || "0", 10))}
          />
          <div className="flex items-center justify-between text-xs text-muted mt-1">
            <span>Balance: {chips.toLocaleString()} chips</span>
            <button
              type="button"
              onClick={() => setStake(chips)}
              className="text-accent hover:underline"
            >
              All-in
            </button>
          </div>
        </div>
        {projected != null && (
          <div className="text-sm text-muted">
            If this outcome wins right now, you would receive about{" "}
            <span className="text-win font-semibold">{projected.toLocaleString()}</span> chips.
            Odds drift as more bets come in.
          </div>
        )}
        {context?.odds == null && (
          <div className="text-xs text-warn">
            Odds are hidden until admin starts the round — you&apos;re placing a blind bet.
          </div>
        )}
        {error && <p className="text-loss text-sm">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          {[50, 100, 250].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setStake(Math.min(chips, n))}
              className="btn"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn">
            Cancel
          </button>
          <button
            onClick={onPlace}
            disabled={placing || stake <= 0 || stake > chips}
            className="btn-primary"
          >
            {placing ? "Placing…" : `Place ${stake.toLocaleString()} chip bet`}
          </button>
        </div>
      </div>
    </div>
  );
}
