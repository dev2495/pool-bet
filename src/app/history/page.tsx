"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import StatusPill from "@/components/StatusPill";

type Bet = {
  id: string;
  stake: number;
  payout: number;
  status: string;
  createdAt: string;
  match: { id: string; name: string };
  outcome: { id: string; label: string };
};
type Group = {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  bets: Bet[];
  ledger: Txn[];
  staked: number;
  returned: number;
  resetAmount: number;
  endingBalance: number | null;
};
type Txn = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  sessionId: string | null;
  createdAt: string;
};
type Resp = {
  user: { id: string; name: string; chips: number; loginCode: string };
  summary: {
    staked: number;
    returned: number;
    pnl: number;
    settled: number;
    wins: number;
    losses: number;
    total: number;
  };
  ledger: Txn[];
  sessions: Group[];
};

export default function HistoryPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          if (j.error?.includes("Not signed")) window.location.href = "/";
          return;
        }
        setData(j.data);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div>
        <Nav active="history" />
        <main className="page-shell text-muted">Loading…</main>
      </div>
    );
  }

  const pnlPositive = data.summary.pnl >= 0;
  const cashLedger = data.ledger.filter((t) =>
    ["PAY_IN", "PAY_OUT", "GRANT"].includes(t.type) ||
    t.note?.startsWith("Session settled reset:")
  );
  return (
    <div>
      <Nav active="history" />
      <main className="page-shell app-fade-in">
        <header className="workspace-head">
          <div>
            <div className="label">Player history</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.user.name}</h1>
            <p className="mt-1 text-sm leading-6 text-muted">
              Code <span className="font-mono text-ink">{data.user.loginCode}</span> · current
              balance {data.user.chips.toLocaleString()} chips. Settled sessions reset back to 0.
            </p>
          </div>
          <div className="rounded-md border border-line bg-panel2 px-3 py-2 text-right">
            <div className="kpi-label">Lifetime P/L</div>
            <div className={"text-2xl font-bold tabular-nums " + (pnlPositive ? "text-win" : "text-loss")}>
              {pnlPositive ? "+" : ""}
              {data.summary.pnl.toLocaleString()}
            </div>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Lifetime P/L" value={data.summary.pnl} signed positive={pnlPositive} />
          <Stat label="Total wagered" value={data.summary.staked} />
          <Stat label="Total returned" value={data.summary.returned} />
          <Stat
            label="Record"
            text={`${data.summary.wins}-${data.summary.losses} (${data.summary.total} bets)`}
          />
        </section>

        {cashLedger.length > 0 && (
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Pay-in / payout ledger</h2>
                <p className="text-xs text-muted">
                  Admin chip pay-ins and player settlement payouts. A payout to zero starts the next cycle.
                </p>
              </div>
              <span className="text-xs text-muted">{cashLedger.length} rows</span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {cashLedger.slice(0, 10).map((t) => (
                <div key={t.id} className="ledger-row flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">{t.type.replaceAll("_", " ")}</div>
                    <div className="text-xs text-muted">
                      {t.note || "No note"} · {new Date(t.createdAt).toLocaleString()}
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
              ))}
            </div>
          </section>
        )}

        {data.sessions.length === 0 && (
          <div className="card text-center text-muted">No bets yet.</div>
        )}

        <div className="space-y-6">
          {data.sessions.map((g) => {
            const pnl = g.returned - g.staked;
            return (
              <section key={g.sessionId} className="card space-y-3">
                <header className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{g.sessionName}</h3>
                  <StatusPill status={g.sessionStatus} />
                  <div className="ml-auto text-sm font-semibold">
                    <span className="text-muted">P/L: </span>
                    <span className={pnl >= 0 ? "text-win" : "text-loss"}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toLocaleString()}
                    </span>
                  </div>
                </header>
                <div className="hidden overflow-x-auto md:block">
                <table className="table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Pick</th>
                      <th>Stake</th>
                      <th>Result</th>
                      <th>Payout</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.bets.map((b) => {
                      const net = (b.payout || 0) - b.stake;
                      return (
                        <tr key={b.id}>
                          <td>{b.match.name}</td>
                          <td>{b.outcome.label}</td>
                          <td className="chip-num">{b.stake.toLocaleString()}</td>
                          <td>
                            <StatusPill status={b.status} />
                          </td>
                          <td className="chip-num">{(b.payout || 0).toLocaleString()}</td>
                          <td className={"chip-num " + (net > 0 ? "text-win" : net < 0 ? "text-loss" : "text-muted")}>
                            {net > 0 ? "+" : ""}
                            {net.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="space-y-2 md:hidden">
                  {g.bets.map((b) => {
                    const net = (b.payout || 0) - b.stake;
                    return (
                      <div key={b.id} className="ledger-row">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold leading-tight">{b.match.name}</div>
                            <div className="mt-1 text-sm text-muted">{b.outcome.label}</div>
                          </div>
                          <StatusPill status={b.status} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="kpi-label">Stake</div>
                            <div className="font-mono font-bold">{b.stake.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="kpi-label">Payout</div>
                            <div className="font-mono font-bold">{(b.payout || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-right">
                            <div className="kpi-label">Net</div>
                            <div className={"font-mono font-bold " + (net > 0 ? "text-win" : net < 0 ? "text-loss" : "text-muted")}>
                              {net > 0 ? "+" : ""}
                              {net.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="ledger-row">
                    <div className="text-xs text-muted">Session staked</div>
                    <div className="font-mono font-bold">{g.staked.toLocaleString()}</div>
                  </div>
                  <div className="ledger-row">
                    <div className="text-xs text-muted">Session returned</div>
                    <div className="font-mono font-bold">{g.returned.toLocaleString()}</div>
                  </div>
                  <div className="ledger-row">
                    <div className="text-xs text-muted">Session net</div>
                    <div className={"font-mono font-bold " + (pnl >= 0 ? "text-win" : "text-loss")}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toLocaleString()}
                    </div>
                  </div>
                  <div className="ledger-row">
                    <div className="text-xs text-muted">Settlement reset</div>
                    <div className="font-mono font-bold text-muted">
                      {g.endingBalance == null
                        ? "pending"
                        : `${g.resetAmount.toLocaleString()} -> ${g.endingBalance.toLocaleString()}`}
                    </div>
                  </div>
                </div>
                {g.ledger.length > 0 && (
                  <div className="space-y-2">
                    <div className="label">Session ledger</div>
                    {g.ledger.slice(0, 6).map((t) => (
                      <div key={t.id} className="ledger-row flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm">{t.type.replaceAll("_", " ")}</div>
                          <div className="text-xs text-muted">
                            {t.note || "No note"} · {new Date(t.createdAt).toLocaleString()}
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
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  text,
  signed,
  positive,
}: {
  label: string;
  value?: number;
  text?: string;
  signed?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div
        className={
          "kpi-value " +
          (signed ? (positive ? "text-win" : "text-loss") : "text-ink")
        }
      >
        {value != null
          ? (signed && positive ? "+" : "") + value.toLocaleString()
          : text}
      </div>
    </div>
  );
}
