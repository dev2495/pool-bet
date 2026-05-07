"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";

type PlayerRow = {
  id: string;
  userName: string;
  loginCode: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  sessionId: string | null;
  createdAt: string;
};

type HouseRow = {
  id: string;
  amount: number;
  totalPool: number;
  totalPaid: number;
  rakeBps: number;
  note: string | null;
  matchName: string | null;
  sessionName: string;
  createdAt: string;
};

type LedgerResp = {
  totals: {
    playerTxnTotal: number;
    playerBalanceTotal: number;
    houseTotal: number;
    inBalance: boolean;
  };
  playerLedger: PlayerRow[];
  houseLedger: HouseRow[];
};

export default function AdminLedgerPage() {
  const [data, setData] = useState<LedgerResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          if (j.error?.includes("Admin") || j.error?.includes("not")) {
            window.location.href = "/admin/login";
            return;
          }
          setErr(j.error || "Could not load ledger");
          return;
        }
        setData(j.data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <Nav active="admin" />
      <main className="page-shell app-fade-in">
        <header className="workspace-head">
          <div>
            <div className="label">Global ledger</div>
            <h1 className="text-2xl font-bold tracking-tight">Players, house rake, reconciliation</h1>
            <p className="mt-1 text-sm text-muted">
              Every chip movement is visible here. Player balances must match player ledger totals.
            </p>
          </div>
          <Link href="/admin" className="btn">
            Back to admin
          </Link>
        </header>

        {loading && <p className="text-muted">Loading...</p>}
        {err && <p className="text-loss">{err}</p>}
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <Stat label="Player ledger total" value={data.totals.playerTxnTotal} signed />
              <Stat label="Current chips in play" value={data.totals.playerBalanceTotal} />
              <Stat label="House rake ledger" value={data.totals.houseTotal} />
              <div className="kpi">
                <div className="kpi-label">Reconciliation</div>
                <div className={"kpi-value " + (data.totals.inBalance ? "text-win" : "text-loss")}>
                  {data.totals.inBalance ? "MATCH" : "GAP"}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Player ledger</h2>
                  <span className="text-xs text-muted">{data.playerLedger.length} rows</span>
                </div>
                <div className="max-h-[640px] overflow-y-auto space-y-2 pr-1">
                  {data.playerLedger.map((t) => (
                    <div key={t.id} className="ledger-row">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {t.userName} <span className="font-mono text-xs text-muted">{t.loginCode}</span>
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
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">House rake ledger</h2>
                  <span className="text-xs text-muted">{data.houseLedger.length} rows</span>
                </div>
                <div className="max-h-[640px] overflow-y-auto space-y-2 pr-1">
                  {data.houseLedger.map((h) => (
                    <div key={h.id} className="ledger-row">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{h.matchName || h.sessionName}</div>
                          <div className="text-xs text-muted">
                            {h.sessionName} · pool {h.totalPool.toLocaleString()} · paid{" "}
                            {h.totalPaid.toLocaleString()} · rake {(h.rakeBps / 100).toFixed(2)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-win">+{h.amount.toLocaleString()}</div>
                          <div className="text-xs text-muted">house</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.houseLedger.length === 0 && (
                    <div className="text-sm text-muted">No settled rake rows yet.</div>
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

function Stat({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const positive = value >= 0;
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={"kpi-value " + (signed ? (positive ? "text-win" : "text-loss") : "")}>
        {signed && positive ? "+" : ""}
        {value.toLocaleString()}
      </div>
    </div>
  );
}
