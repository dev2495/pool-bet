"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import StatusPill from "@/components/StatusPill";
import { teamShort } from "@/lib/ipl";

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
  startsAt: string | null;
  bettingOpensAt: string | null;
  source: string | null;
  homeCode: string | null;
  awayCode: string | null;
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
    if (!picking || stake < 50 || !Number.isInteger(stake)) {
      setError("Minimum bet is 50 chips. Use whole chips only.");
      return;
    }
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
          <div className="card py-8 text-center text-muted">
            <div className="text-lg font-bold text-ink">No live pools yet</div>
            <p className="mt-1 text-sm">Wait for the admin to open a session.</p>
          </div>
        )}

        {!loading && me && (
          <header className="workspace-head overflow-hidden">
            <div>
              <div className="label">Player board</div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Live pools</h1>
              <p className="mt-1 text-sm leading-6 text-muted">
                {me.name} · current chips{" "}
                <span className="font-mono font-bold text-ink">{me.chips.toLocaleString()}</span>.
                Pick a side and confirm your stake.
              </p>
            </div>
            <div className="grid min-w-[9rem] grid-cols-2 gap-2 sm:block sm:text-right">
              <div className="rounded-md border border-line bg-panel2 px-3 py-2">
                <div className="kpi-label">Chips</div>
                <div className="text-xl font-bold tabular-nums">{me.chips.toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-line bg-panel2 px-3 py-2 sm:mt-2">
                <div className="kpi-label">Pools</div>
                <div className="text-xl font-bold tabular-nums">{sessions.length}</div>
              </div>
            </div>
          </header>
        )}

        {sessions.map((s) => (
          <section key={s.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{s.name}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted shadow-sm">
                Match group
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted shadow-sm">
                Rake {(s.rakeBps / 100).toFixed(2)}%
              </span>
            </div>

            {s.matches.length === 0 && <p className="text-muted text-sm">No matches yet.</p>}

            <div className="grid lg:grid-cols-2 gap-3">
              {s.matches.map((m) => (
                <article key={m.id} className="card space-y-3">
                  <header className="flex items-start gap-2">
                    {(m.homeCode || m.awayCode) && (
                      <TeamPair homeCode={m.homeCode} awayCode={m.awayCode} />
                    )}
                    <div className="flex-1">
                      <div className="text-lg font-bold leading-tight">{m.name}</div>
                      {m.description && (
                        <div className="mt-1 text-xs text-muted">{m.description}</div>
                      )}
                      <MatchTiming startsAt={m.startsAt} bettingOpensAt={m.bettingOpensAt} />
                    </div>
                    <StatusPill status={m.status} />
                  </header>

                  <div className="space-y-2">
                    {m.outcomes.map((o) => {
                      const myStake = m.myBets
                        .filter((b) => b.outcomeId === o.id)
                        .reduce((s, b) => s + b.stake, 0);
                      const winnerHere = m.winningOutcomeId === o.id;
                      const bettingLocked =
                        !!m.bettingOpensAt && new Date(m.bettingOpensAt).getTime() > Date.now();
                      const canBet =
                        (m.status === "OPEN" || m.status === "LIVE") &&
                        !bettingLocked &&
                        (s.status === "OPEN" || s.status === "LIVE");
                      return (
                        <button
                          key={o.id}
                          onClick={() =>
                            canBet ? setPicking({ matchId: m.id, outcomeId: o.id }) : null
                          }
                          disabled={!canBet}
                          className={
                            "w-full rounded-md border px-3 py-3.5 text-left transition " +
                            (winnerHere
                              ? "border-win/60 bg-win/10"
                              : canBet
                              ? "border-line bg-white hover:border-accent/70 hover:bg-panel2"
                              : "border-line bg-panel2 opacity-70 cursor-not-allowed")
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold">{o.label}</div>
                              {myStake > 0 && (
                                <div className="mt-1 text-xs font-semibold text-accent">
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
                                <div className="text-[11px] text-muted">
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

                  <footer className="flex items-center justify-between gap-3 border-t border-line/70 pt-3 text-xs text-muted">
                    <span>
                      {m.betCount} bets total
                      {m.bettingOpensAt && new Date(m.bettingOpensAt).getTime() > Date.now()
                        ? " · locked"
                        : ""}
                    </span>
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

function TeamPair({
  homeCode,
  awayCode,
}: {
  homeCode: string | null;
  awayCode: string | null;
}) {
  return (
    <div className="flex shrink-0 -space-x-2 pt-0.5">
      <TeamBadge code={homeCode} />
      <TeamBadge code={awayCode} />
    </div>
  );
}

function TeamBadge({ code }: { code: string | null }) {
  return (
    <div
      className={
        "grid h-11 w-11 place-items-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-sm " +
        teamBadgeClass(code)
      }
    >
      {teamShort(code)}
    </div>
  );
}

function teamBadgeClass(code: string | null) {
  switch (code) {
    case "CSK":
      return "bg-gradient-to-br from-[#ffe55c] to-[#f5b51b] text-ink";
    case "DC":
      return "bg-gradient-to-br from-[#1f74d4] to-[#e42f3a]";
    case "GT":
      return "bg-gradient-to-br from-[#101d3b] to-[#c7a253]";
    case "KKR":
      return "bg-gradient-to-br from-[#34105f] to-[#d5a332]";
    case "LSG":
      return "bg-gradient-to-br from-[#29a9e8] to-[#ef7d22]";
    case "MI":
      return "bg-gradient-to-br from-[#005da8] to-[#19a8e0]";
    case "PBKS":
      return "bg-gradient-to-br from-[#d71920] to-[#f4b2b2]";
    case "RR":
      return "bg-gradient-to-br from-[#e91e8f] to-[#234aa8]";
    case "RCB":
      return "bg-gradient-to-br from-[#d71920] to-[#111827]";
    case "SRH":
      return "bg-gradient-to-br from-[#f97316] to-[#111827]";
    default:
      return "bg-gradient-to-br from-slate-500 to-slate-800";
  }
}

function MatchTiming({
  startsAt,
  bettingOpensAt,
}: {
  startsAt: string | null;
  bettingOpensAt: string | null;
}) {
  if (!startsAt && !bettingOpensAt) return null;
  const start = startsAt ? formatIst(startsAt) : null;
  const open = bettingOpensAt ? formatIst(bettingOpensAt) : null;
  const locked = bettingOpensAt ? new Date(bettingOpensAt).getTime() > Date.now() : false;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
      {start && <span className="rounded-full bg-panel2 px-2 py-1 text-muted">{start}</span>}
      {open && (
        <span className={"rounded-full px-2 py-1 " + (locked ? "bg-warn/10 text-warn" : "bg-win/10 text-win")}>
          {locked ? `Bets open ${open}` : "Betting open"}
        </span>
      )}
    </div>
  );
}

function formatIst(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
    <div className="fixed inset-0 z-40 flex items-end bg-ink/28 backdrop-blur-sm sm:grid sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="mobile-sheet w-full space-y-4 sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-12 rounded-full bg-line sm:hidden" />
        <header>
          <div className="label">Place bet</div>
          {context && (
            <div className="text-lg font-bold leading-tight">
              {context.match} <span className="text-muted">/</span>{" "}
              <span className="text-accent">{context.outcome}</span>
            </div>
          )}
        </header>
        <div>
          <label className="label">Stake (chips)</label>
          <input
            autoFocus
            type="number"
            min={50}
            step={1}
            max={chips}
            className="input"
            value={stake || ""}
            onChange={(e) => {
              const next = e.target.value === "" ? 0 : Number(e.target.value);
              setStake(Number.isFinite(next) ? next : 0);
            }}
          />
        <div className="flex items-center justify-between text-xs text-muted mt-1">
            <span>Balance: {chips.toLocaleString()} chips · minimum 50</span>
            <button
              type="button"
              onClick={() => setStake(chips)}
              className="font-bold text-accent hover:underline"
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
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 100, 250].map((n) => (
            <button type="button" key={n} onClick={() => setStake(Math.min(chips, n))} className="btn">
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <button onClick={onClose} className="btn">
            Cancel
          </button>
          <button
            onClick={onPlace}
            disabled={placing || stake < 50 || !Number.isInteger(stake) || stake > chips}
            className="btn-primary"
          >
            {placing ? "Placing…" : `Place ${stake.toLocaleString() || 0}`}
          </button>
        </div>
      </div>
    </div>
  );
}
