"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import StatusPill from "@/components/StatusPill";

type Outcome = {
  id: string;
  label: string;
  poolChips: number;
  betCount: number;
  oddsDecimal: number | null;
  share: number;
};
type MatchRow = {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  bettingOpensAt: string | null;
  source: string | null;
  homeCode: string | null;
  awayCode: string | null;
  status: string;
  winningOutcomeId: string | null;
  betCount: number;
  outcomes: Outcome[];
  totalPool: number;
  rakeBps: number;
  bets: {
    id: string;
    userName: string;
    loginCode: string;
    outcomeId: string;
    outcomeLabel: string;
    stake: number;
    payout: number;
    status: string;
    createdAt: string;
    settledAt: string | null;
  }[];
};
type Sess = {
  id: string;
  name: string;
  rakeBps: number;
  status: string;
  liveAt: string | null;
  closedAt: string | null;
  settledAt: string | null;
};
type SessionLedgerRow = {
  id: string;
  userName: string;
  loginCode: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};
type HouseLedgerRow = {
  id: string;
  amount: number;
  totalPool: number;
  totalPaid: number;
  rakeBps: number;
  note: string | null;
  matchId: string | null;
  sessionId: string;
  createdAt: string;
};

export default function AdminSessionDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<{
    session: Sess;
    matches: MatchRow[];
    ledger: SessionLedgerRow[];
    houseLedger: HouseLedgerRow[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // create-match form
  const [mName, setMName] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mStartsAt, setMStartsAt] = useState("");
  const [outA, setOutA] = useState("Team A");
  const [outB, setOutB] = useState("Team B");
  const [outC, setOutC] = useState("");
  const [adding, setAdding] = useState(false);

  // edit-rake
  const [rakeEdit, setRakeEdit] = useState<string>("");

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/admin/sessions/${id}`, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) {
      if (r.status === 401 || r.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      setErr(j.error);
      return;
    }
    setData(j.data);
    if (rakeEdit === "") setRakeEdit((j.data.session.rakeBps / 100).toString());
  }, [id, rakeEdit]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [id, refresh]);

  async function transition(action: "open" | "live" | "close" | "settle") {
    const r = await fetch(`/api/admin/sessions/${id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function saveRake() {
    const rakeBps = Math.round(parseFloat(rakeEdit) * 100);
    const r = await fetch(`/api/admin/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rakeBps }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const outcomes = [outA, outB, outC].map((s) => s.trim()).filter(Boolean);
    const startsAtIso = mStartsAt ? new Date(mStartsAt).toISOString() : "";
    const r = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: id, name: mName, description: mDesc, startsAt: startsAtIso, outcomes }),
    });
    const j = await r.json();
    setAdding(false);
    if (!j.ok) {
      alert(j.error);
      return;
    }
    setMName("");
    setMDesc("");
    setMStartsAt("");
    setOutC("");
    refresh();
  }

  async function closeMatch(mid: string) {
    const r = await fetch(`/api/admin/matches/${mid}/close`, { method: "POST" });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function openMatch(mid: string, label: string) {
    if (!confirm(`${label} for this match now? This overrides the scheduled betting window for that match only.`)) return;
    const r = await fetch(`/api/admin/matches/${mid}/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ immediate: true }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function liveMatch(mid: string) {
    if (!confirm("Go live for this match? Odds and pool totals become visible for this match only.")) return;
    const r = await fetch(`/api/admin/matches/${mid}/live`, { method: "POST" });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function settleMatch(mid: string, winningOutcomeId: string) {
    if (!confirm("Settle this match? Payouts run from the pool right now.")) return;
    const r = await fetch(`/api/admin/matches/${mid}/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ winningOutcomeId }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function voidMatchProper(mid: string) {
    if (!confirm("Void this match? All stakes refunded — no rake taken.")) return;
    const r = await fetch(`/api/admin/matches/${mid}/settle`, { method: "DELETE" });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  async function deleteMatch(mid: string) {
    if (!confirm("Delete this match? Only allowed if no bets exist on it.")) return;
    const r = await fetch(`/api/admin/matches/${mid}`, { method: "DELETE" });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return;
    }
    refresh();
  }

  if (!data) {
    return (
      <div>
        <Nav active="admin" />
      <main className="page-shell text-muted">
          {err || "Loading…"}
        </main>
      </div>
    );
  }

  const s = data.session;
  const canOpen = s.status === "DRAFT";
  const acceptingMatches = data.matches.filter(
    (m) => m.status === "PENDING" || m.status === "OPEN" || m.status === "LIVE"
  );
  const unresolvedMatches = data.matches.filter((m) => m.status !== "SETTLED" && m.status !== "VOID");
  const canClose = (s.status === "OPEN" || s.status === "LIVE") && acceptingMatches.length === 0;
  const canSettle = s.status === "CLOSED" && unresolvedMatches.length === 0;
  const canEditRake = s.status === "DRAFT" || s.status === "OPEN";
  const canAddMatches = s.status === "DRAFT" || s.status === "OPEN" || s.status === "LIVE";
  const matchNames = new Map(data.matches.map((m) => [m.id, m.name]));

  return (
    <div>
      <Nav active="admin" />
      <main className="page-shell app-fade-in">
        <header className="workspace-head">
          <div>
            <div className="label">Match group control room</div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{s.name}</h1>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted shadow-sm">
                Group container
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              This group only keeps matches together. Open, go live, close, void, and settle each match below.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Rake</span>
              <input
                className="input w-20"
                disabled={!canEditRake}
                value={rakeEdit}
                onChange={(e) => setRakeEdit(e.target.value)}
                type="number"
                step={0.25}
                min={0}
                max={99}
              />
              <span>%</span>
              {canEditRake && (
                <button className="btn" onClick={saveRake}>
                  Save
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="card grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button className={canOpen ? "btn-primary" : "btn"} disabled={!canOpen} onClick={() => transition("open")}>
            Open group
          </button>
          <button className="btn" disabled={!canClose} onClick={() => transition("close")}>
            Close group
          </button>
          <button className={canSettle ? "btn-primary" : "btn"} disabled={!canSettle} onClick={() => transition("settle")}>
            Settle group
          </button>
          <p className="col-span-2 mt-2 w-full text-xs leading-5 text-muted">
            The group is not the betting switch. Every match follows: Open hidden → Go live → Close match → Winner/void.
            Player payouts are blocked only when that player still has active unsettled bets.
            {acceptingMatches.length > 0 && (
              <span className="block font-bold text-warn">
                {acceptingMatches.length} match(es) are still accepting bets or scheduled, so group close is locked.
              </span>
            )}
          </p>
        </section>

        {(data.ledger.length > 0 || data.houseLedger.length > 0) && (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Session ledger</h3>
                  <p className="text-xs text-muted">
                    Player-wise settlement, payouts, stakes, and reset entries for this session.
                  </p>
                </div>
                <span className="text-xs text-muted">{data.ledger.length} rows</span>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {data.ledger.slice(0, 12).map((t) => (
                  <div key={t.id} className="ledger-row">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {t.userName}{" "}
                          <span className="font-mono text-xs text-muted">{t.loginCode}</span>
                        </div>
                        <div className="text-xs text-muted">
                          {t.type.replaceAll("_", " ")} · {t.note || "No note"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={"font-mono font-bold " + (t.amount >= 0 ? "text-win" : "text-loss")}>
                          {t.amount >= 0 ? "+" : ""}
                          {t.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted">
                          balance {t.balanceAfter.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">House rake ledger</h3>
                  <p className="text-xs text-muted">
                    Pool retained by the house for settled matches in this session.
                  </p>
                </div>
                <span className="text-xs text-muted">{data.houseLedger.length} rows</span>
              </div>
              <div className="space-y-2">
                {data.houseLedger.map((h) => (
                  <div key={h.id} className="ledger-row">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {h.matchId ? matchNames.get(h.matchId) || "Settled match" : s.name}
                        </div>
                        <div className="text-xs text-muted">
                          pool {h.totalPool.toLocaleString()} · paid {h.totalPaid.toLocaleString()} · rake{" "}
                          {(h.rakeBps / 100).toFixed(2)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-win">
                          +{h.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted">house</div>
                      </div>
                    </div>
                  </div>
                ))}
                {data.houseLedger.length === 0 && (
                  <div className="text-sm text-muted">No house rake rows yet.</div>
                )}
              </div>
            </div>
          </section>
        )}

        {canAddMatches && (
          <section className="card space-y-3">
            <h3 className="font-semibold">Add a match</h3>
            <form onSubmit={addMatch} className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Match name (e.g. Lakers vs Celtics)"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Description (optional, e.g. Game 7 NBA Finals)"
                  value={mDesc}
                  onChange={(e) => setMDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Scheduled start (optional)</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={mStartsAt}
                  onChange={(e) => setMStartsAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  If set, betting opens automatically 1 hour before this time.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="input"
                  placeholder="Outcome 1"
                  value={outA}
                  onChange={(e) => setOutA(e.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Outcome 2"
                  value={outB}
                  onChange={(e) => setOutB(e.target.value)}
                  required
                />
                <input
                  className="input"
                  placeholder="Outcome 3 (optional, e.g. Draw)"
                  value={outC}
                  onChange={(e) => setOutC(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full sm:w-auto" disabled={adding || !mName}>
                {adding ? "Adding…" : "Add match"}
              </button>
            </form>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">Matches ({data.matches.length})</h3>
              <p className="text-xs text-muted">
                Each match has its own betting window, manual close, void, and settlement ledger.
              </p>
            </div>
            <div className="text-sm text-muted">
              Total pool{" "}
              <span className="font-mono text-ink">
                {data.matches.reduce((sum, m) => sum + m.totalPool, 0).toLocaleString()}
              </span>
            </div>
          </div>
          {data.matches.length === 0 && (
            <div className="card text-muted text-sm">No matches yet.</div>
          )}
          <div className="space-y-3">
            {data.matches.map((m) => (
              <article key={m.id} className="card space-y-2">
                <header className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-lg font-bold leading-tight">{m.name}</div>
                    {m.description && (
                      <div className="text-xs text-muted">{m.description}</div>
                    )}
                    {(m.startsAt || m.bettingOpensAt || m.source) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {m.source && (
                          <span className="rounded-full bg-panel2 px-2 py-1 text-muted">{m.source}</span>
                        )}
                        {m.startsAt && (
                          <span className="rounded-full bg-panel2 px-2 py-1 text-muted">
                            {new Date(m.startsAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {m.bettingOpensAt && (
                          <span className="rounded-full bg-warn/10 px-2 py-1 text-warn">
                            Bets open{" "}
                            {new Date(m.bettingOpensAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {m.status === "OPEN" && (
                          <span className="rounded-full bg-panel2 px-2 py-1 text-muted">
                            odds hidden
                          </span>
                        )}
                        {m.status === "LIVE" && (
                          <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">
                            odds visible
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <StatusPill status={m.status} />
                </header>
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-1.5">
                  {m.outcomes.map((o) => {
                    const isWinner = m.winningOutcomeId === o.id;
                    return (
                      <div
                        key={o.id}
                        className={
                          "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5 " +
                          (isWinner
                            ? "border-win/60 bg-win/10"
                            : "border-line/60 bg-panel2")
                        }
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold">{o.label}</div>
                          <div className="text-[11px] text-muted">
                            pool {o.poolChips.toLocaleString()} ·{" "}
                            {(o.share * 100).toFixed(1)}% · {o.betCount} bets
                          </div>
                        </div>
                        <div className="text-right text-sm font-mono tabular-nums">
                          {o.oddsDecimal != null ? `×${o.oddsDecimal.toFixed(2)}` : "—"}
                        </div>
                        {m.status === "CLOSED" && !isWinner && (
                          <button
                            className="btn"
                            onClick={() => settleMatch(m.id, o.id)}
                            title="Pick this as winner"
                          >
                            Winner
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-line/70 bg-bg/35 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="label mb-0">Bets and ledger preview</div>
                    <span className="text-xs text-muted">{m.bets.length} rows</span>
                  </div>
                  {m.bets.length === 0 ? (
                    <div className="text-sm text-muted">No player bets on this match yet.</div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {m.bets.map((b) => {
                        const net = (b.payout || 0) - b.stake;
                        return (
                          <div key={b.id} className="ledger-row">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  {b.userName}{" "}
                                  <span className="font-mono text-xs text-muted">{b.loginCode}</span>
                                </div>
                                <div className="text-xs text-muted">
                                  {b.outcomeLabel} · stake {b.stake.toLocaleString()} · {b.status}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={"font-mono text-sm font-bold " + (net > 0 ? "text-win" : net < 0 ? "text-loss" : "text-muted")}>
                                  {net > 0 ? "+" : ""}
                                  {net.toLocaleString()}
                                </div>
                                <div className="text-[11px] text-muted">
                                  paid {(b.payout || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-xs text-muted">
                  <span>
                    {m.betCount} bets · pool {m.totalPool.toLocaleString()}
                  </span>
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:items-center sm:gap-1">
                    {m.status === "PENDING" && (
                      <button className="btn-primary" onClick={() => openMatch(m.id, "Open betting")}>
                        Open hidden
                      </button>
                    )}
                    {m.status === "OPEN" &&
                      m.bettingOpensAt &&
                      new Date(m.bettingOpensAt).getTime() > Date.now() && (
                        <button className="btn-primary" onClick={() => openMatch(m.id, "Open betting")}>
                          Open now
                        </button>
                      )}
                    {m.status === "OPEN" && (
                      <button className="btn-primary" onClick={() => liveMatch(m.id)}>
                        Go live
                      </button>
                    )}
                    {m.status === "CLOSED" && !m.winningOutcomeId && (
                      <button className="btn" onClick={() => openMatch(m.id, "Re-open betting")}>
                        Re-open hidden
                      </button>
                    )}
                    {(m.status === "OPEN" || m.status === "LIVE") && (
                      <button className="btn" onClick={() => closeMatch(m.id)}>
                        Close match
                      </button>
                    )}
                    {(m.status === "OPEN" || m.status === "LIVE" || m.status === "CLOSED") && (
                      <button className="btn-danger" onClick={() => voidMatchProper(m.id)}>
                        Void & refund
                      </button>
                    )}
                    {m.betCount === 0 && m.status === "PENDING" && (
                      <button className="btn-danger" onClick={() => deleteMatch(m.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
