import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import type { Prisma, Transaction } from "@prisma/client";

export const dynamic = "force-dynamic";

type HistoryBet = Prisma.BetGetPayload<{
  include: {
    match: { select: { id: true; name: true; sessionId: true; winningOutcomeId: true } };
    outcome: { select: { id: true; label: true } };
  };
}>;
type HistoryTxn = Transaction;

// GET /api/history — returns the user's full betting history grouped by session
// and a per-session P/L summary.
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const bets = await prisma.bet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        match: { select: { id: true, name: true, sessionId: true, winningOutcomeId: true } },
        outcome: { select: { id: true, label: true } },
      },
    });

    // Group by sessionId
    const groups = new Map<
      string,
      {
        sessionId: string;
        sessionName: string;
        sessionStatus: string;
        bets: HistoryBet[];
        ledger: HistoryTxn[];
        staked: number;
        returned: number;
        resetAmount: number;
        endingBalance: number | null;
      }
    >();
    const sessionIds = Array.from(new Set(bets.map((b) => b.match.sessionId)));
    const sessions = await prisma.session.findMany({
      where: { id: { in: sessionIds } },
      select: { id: true, name: true, status: true },
    });
    const sessionsById = new Map(sessions.map((s) => [s.id, s]));

    for (const b of bets) {
      const meta = sessionsById.get(b.match.sessionId);
      if (!meta) continue;
      if (!groups.has(meta.id)) {
        groups.set(meta.id, {
          sessionId: meta.id,
          sessionName: meta.name,
          sessionStatus: meta.status,
          bets: [],
          ledger: [],
          staked: 0,
          returned: 0,
          resetAmount: 0,
          endingBalance: null,
        });
      }
      const g = groups.get(meta.id)!;
      g.bets.push(b);
      g.staked += b.stake;
      g.returned += b.payout || 0;
    }

    const txns = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    for (const t of txns) {
      if (!t.sessionId) continue;
      const g = groups.get(t.sessionId);
      if (!g) continue;
      g.ledger.push(t);
      if (
        (t.type === "PAY_OUT" && t.balanceAfter === 0) ||
        t.note?.startsWith("Session settled reset:")
      ) {
        g.resetAmount += t.amount;
        g.endingBalance = t.balanceAfter;
      }
    }

    // Lifetime totals
    const staked = bets.reduce((s, b) => s + b.stake, 0);
    const returned = bets.reduce((s, b) => s + (b.payout || 0), 0);
    const settled = bets.filter((b) => b.status !== "ACTIVE").length;
    const wins = bets.filter((b) => b.status === "WON").length;
    const losses = bets.filter((b) => b.status === "LOST").length;

    return ok({
      user: { id: user.id, name: user.name, chips: user.chips, loginCode: user.loginCode },
      summary: { staked, returned, pnl: returned - staked, settled, wins, losses, total: bets.length },
      ledger: txns,
      sessions: Array.from(groups.values()).sort((a, b) =>
        a.sessionStatus.localeCompare(b.sessionStatus)
      ),
    });
  });
}
