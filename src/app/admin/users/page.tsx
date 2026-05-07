"use client";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type U = {
  id: string;
  name: string;
  phone: string;
  loginCode: string;
  chips: number;
  bets: number;
  createdAt: string;
};
type Txn = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  betId: string | null;
  matchId: string | null;
  createdAt: string;
};
type LedgerSummary = {
  lifetimePayIn: number;
  lifetimePayOut: number;
  currentCyclePayIn: number;
  currentCycleStaked: number;
  currentCycleReturned: number;
  currentCyclePnl: number;
  settlementCount: number;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<U | null>(null);
  const [selected, setSelected] = useState<U | null>(null);
  const [ledger, setLedger] = useState<Txn[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  async function refresh() {
    const r = await fetch("/api/admin/users", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) {
      if (r.status === 401 || r.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      setErr(j.error);
      return;
    }
    setUsers(j.data.users);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setErr(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const j = await r.json();
    setCreating(false);
    if (!j.ok) {
      setErr(j.error);
      return;
    }
    setJustCreated(j.data.user);
    setName("");
    setPhone("");
    refresh();
  }

  async function postChips(id: string, body: { amount?: number; action?: "settle"; note?: string }) {
    const r = await fetch(`/api/admin/users/${id}/chips`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error);
      return null;
    }
    await refresh();
    if (selected?.id === id) {
      const nextSelected = { ...selected, chips: j.data.user.chips };
      setSelected(nextSelected);
      await openLedger(nextSelected);
    }
    return j.data.user as U;
  }

  async function adjustChips(id: string, amount: number) {
    const note = window.prompt(
      `${amount > 0 ? "Pay in" : "Pay out"} ${Math.abs(amount)} chips. Optional note:`,
      amount > 0 ? "Player pay-in" : "Player payout"
    );
    if (note === null) return;
    await postChips(id, { amount, note });
  }

  async function customAdjust(id: string) {
    const raw = window.prompt("Enter chip movement (positive pay-in, negative payout):", "");
    if (!raw) return;
    const amt = parseInt(raw, 10);
    if (!Number.isFinite(amt) || amt === 0) return;
    await adjustChips(id, amt);
  }

  async function settlePlayer(user: U) {
    if (user.chips <= 0) {
      alert("Player has no chips to settle.");
      return;
    }
    const ok = window.confirm(
      `Settle ${user.name} now? This pays out ${user.chips.toLocaleString()} chips and resets their balance to 0.`
    );
    if (!ok) return;
    await postChips(user.id, {
      action: "settle",
      note: `Player settled payout: paid ${user.chips} chips`,
    });
  }

  async function openLedger(user: U) {
    setSelected(user);
    setLedgerLoading(true);
    const r = await fetch(`/api/admin/users/${user.id}/chips`, { cache: "no-store" });
    const j = await r.json();
    setLedgerLoading(false);
    if (!j.ok) {
      alert(j.error);
      return;
    }
    setLedger(j.data.txns);
    setLedgerSummary(j.data.summary);
  }

  return (
    <div>
      <Nav active="users" />
      <main className="page-shell app-fade-in">
        <header className="workspace-head">
          <div>
            <div className="label">Admin player bank</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Player chips and settlements</h1>
            <p className="mt-1 text-sm leading-6 text-muted">
              New codes start at 0. Pay chips in, settle player payouts, and reset balances cleanly.
            </p>
          </div>
          <div className="rounded-md border border-line bg-panel2 px-3 py-2 text-right">
            <div className="kpi-label">Players</div>
            <div className="text-xl font-bold tabular-nums">{users.length}</div>
          </div>
        </header>

        <section className="card space-y-3">
          <h2 className="font-semibold">Add player</h2>
          <form onSubmit={create} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input
              className="input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button className="btn-primary w-full" disabled={creating || !name || !phone}>
              {creating ? "Creating…" : "Create code at 0"}
            </button>
          </form>
          {err && <p className="text-loss text-sm">{err}</p>}
          {justCreated && (
            <div className="rounded-md bg-win/10 border border-win/40 p-3 text-sm">
              <div>
                Created <strong>{justCreated.name}</strong>. Share this login code with them:
              </div>
              <div className="text-2xl font-mono tracking-widest mt-1">
                {justCreated.loginCode}
              </div>
              <div className="mt-1 text-xs text-muted">
                Balance starts at 0. Use pay-in when they buy or receive chips.
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">All players</h2>
            <span className="text-xs text-muted">Click a row for code-wise ledger history.</span>
          </div>
          {loading && <p className="text-muted">Loading…</p>}
          <div className="hidden overflow-x-auto md:block">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Login code</th>
                <th>Chips</th>
                <th>Bets</th>
                <th>Pay in / payout</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="cursor-pointer" onClick={() => openLedger(u)}>
                  <td className="font-semibold">{u.name}</td>
                  <td className="text-muted">{u.phone}</td>
                  <td className="font-mono">{u.loginCode}</td>
                  <td className="chip-num">{u.chips.toLocaleString()}</td>
                  <td className="chip-num text-muted">{u.bets}</td>
                  <td>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => adjustChips(u.id, 100)} className="btn-primary">
                        Pay in 100
                      </button>
                      <button onClick={() => adjustChips(u.id, 1000)} className="btn">
                        Pay in 1k
                      </button>
                      <button onClick={() => customAdjust(u.id)} className="btn">
                        Custom
                      </button>
                      <button onClick={() => settlePlayer(u)} className="btn-danger" disabled={u.chips <= 0}>
                        Settle {u.chips > 0 ? u.chips.toLocaleString() : ""}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
                    No players yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <article key={u.id} className="ledger-row" onClick={() => openLedger(u)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold">{u.name}</div>
                    <div className="mt-1 text-xs text-muted">
                      {u.phone} · code <span className="font-mono text-ink">{u.loginCode}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="kpi-label">Chips</div>
                    <div className="font-mono text-xl font-bold">{u.chips.toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => adjustChips(u.id, 100)} className="btn-primary">
                    Pay in 100
                  </button>
                  <button onClick={() => adjustChips(u.id, 1000)} className="btn">
                    Pay in 1k
                  </button>
                  <button onClick={() => customAdjust(u.id)} className="btn">
                    Custom
                  </button>
                  <button onClick={() => settlePlayer(u)} className="btn-danger" disabled={u.chips <= 0}>
                    Settle {u.chips > 0 ? u.chips.toLocaleString() : ""}
                  </button>
                </div>
                <button
                  className="mt-2 w-full rounded-md bg-panel2 px-3 py-2 text-sm font-bold text-ink"
                  type="button"
                >
                  Open ledger
                </button>
              </article>
            ))}
            {users.length === 0 && !loading && (
              <div className="py-4 text-center text-sm text-muted">No players yet.</div>
            )}
          </div>
        </section>
      </main>
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/28 backdrop-blur-sm sm:block" onClick={() => setSelected(null)}>
          <aside
            className="mobile-sheet ml-auto w-full sm:h-full sm:max-w-xl sm:rounded-none sm:border-l sm:border-t-0 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-line sm:hidden" />
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="label">Player ledger</div>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <div className="mt-1 text-sm text-muted">
                  Code <span className="font-mono text-ink">{selected.loginCode}</span> ·{" "}
                  {selected.chips.toLocaleString()} chips now
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  className="btn-danger"
                  onClick={() => settlePlayer(selected)}
                  disabled={selected.chips <= 0}
                >
                  Settle payout {selected.chips > 0 ? selected.chips.toLocaleString() : ""}
                </button>
                <button className="btn" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </div>
            {ledgerSummary && (
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Lifetime pay-in" value={ledgerSummary.lifetimePayIn} />
                <MiniStat label="Lifetime payout" value={ledgerSummary.lifetimePayOut} />
                <MiniStat label="Cycle pay-in" value={ledgerSummary.currentCyclePayIn} />
                <MiniStat
                  label="Cycle bet P/L"
                  value={ledgerSummary.currentCyclePnl}
                  signed
                />
              </div>
            )}
            {ledgerLoading && <p className="text-muted">Loading ledger…</p>}
            {!ledgerLoading && ledger.length === 0 && (
              <div className="card-tight text-sm text-muted">No ledger entries yet.</div>
            )}
            <div className="space-y-2">
              {ledger.map((t) => (
                <div key={t.id} className="ledger-row">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.type.replaceAll("_", " ")}</div>
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
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const positive = value >= 0;
  return (
    <div className="ledger-row">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={"mt-1 font-mono text-lg font-bold " + (signed ? (positive ? "text-win" : "text-loss") : "")}>
        {signed && positive ? "+" : ""}
        {value.toLocaleString()}
      </div>
    </div>
  );
}
