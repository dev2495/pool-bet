import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";
import { computePayouts } from "@/lib/odds";
import { recordHouseRake } from "@/lib/house-ledger";

// State transitions for a session:
//   open    : DRAFT  -> OPEN     (bets accepted, odds HIDDEN)
//   live    : OPEN   -> LIVE     (odds REVEALED to players)
//   close   : OPEN|LIVE -> CLOSED (no more bets)
//   settle  : CLOSED -> SETTLED  (settles every match that has a winner picked)

const Body = z.object({ action: z.enum(["open", "live", "close", "settle"]) });
type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const { action } = Body.parse(await req.json());
    const s = await prisma.session.findUnique({
      where: { id },
      include: { matches: { include: { bets: true, outcomes: true } } },
    });
    if (!s) return err("Session not found", 404);

    if (action === "open") {
      if (s.status !== "DRAFT") return err("Only DRAFT sessions can be opened", 400);
      if (s.matches.length === 0) return err("Add at least one match before opening", 400);
      // Bring all matches into the OPEN state too.
      await prisma.$transaction([
        prisma.session.update({ where: { id: s.id }, data: { status: "OPEN" } }),
        prisma.match.updateMany({
          where: { sessionId: s.id, status: "PENDING" },
          data: { status: "OPEN" },
        }),
      ]);
      return ok({ status: "OPEN" });
    }

    if (action === "live") {
      if (s.status !== "OPEN") return err("Only OPEN sessions can go LIVE", 400);
      await prisma.session.update({
        where: { id: s.id },
        data: { status: "LIVE", liveAt: new Date() },
      });
      return ok({ status: "LIVE" });
    }

    if (action === "close") {
      if (s.status !== "OPEN" && s.status !== "LIVE")
        return err("Session cannot be closed from this state", 400);
      await prisma.$transaction([
        prisma.session.update({
          where: { id: s.id },
          data: { status: "CLOSED", closedAt: new Date() },
        }),
        prisma.match.updateMany({
          where: { sessionId: s.id, status: "OPEN" },
          data: { status: "CLOSED" },
        }),
      ]);
      return ok({ status: "CLOSED" });
    }

    // settle: every match must have a winner chosen, OR be VOIDed already, OR be SETTLED.
    if (action === "settle") {
      if (s.status !== "CLOSED") return err("Settle only allowed after CLOSED", 400);
      const unresolved = s.matches.filter(
        (m) => m.status === "CLOSED" && !m.winningOutcomeId
      );
      if (unresolved.length > 0)
        return err(
          `Pick a winner (or void) for ${unresolved.length} match(es) before settling`,
          400
        );

      // Sanity-check: ensure we ran payouts for every match.
      const stillCloseable = await prisma.match.findMany({
        where: { sessionId: s.id, status: "CLOSED" },
      });
      // If any remain CLOSED with a winner picked but not settled, run them.
      for (const m of stillCloseable) {
        if (m.winningOutcomeId) {
          await settleMatchInline(m.id);
        }
      }
      const remainingClosed = await prisma.match.count({
        where: { sessionId: s.id, status: "CLOSED" },
      });
      if (remainingClosed > 0) {
        return err(`Could not settle ${remainingClosed} match(es)`, 500);
      }
      await prisma.session.update({
        where: { id: s.id },
        data: { status: "SETTLED", settledAt: new Date() },
      });
      await resetPlayerChipsAfterSession(s.id);
      return ok({ status: "SETTLED" });
    }
  });
}

async function resetPlayerChipsAfterSession(sessionId: string) {
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { name: true },
    });
    const sessionBettors = await tx.bet.findMany({
      where: {
        match: { sessionId },
      },
      distinct: ["userId"],
      select: { userId: true },
    });
    const users = await tx.user.findMany({
      where: {
        id: { in: sessionBettors.map((b) => b.userId) },
        chips: { gt: 0 },
      },
    });

    for (const user of users) {
      const resetAmount = -user.chips;
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { chips: 0 },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "PAY_OUT",
          amount: resetAmount,
          balanceAfter: updated.chips,
          sessionId,
          note: `Session settled payout: paid ${user.chips} chips · ${session?.name || sessionId}`,
        },
      });
    }
  });
}

// In rare cases settle might be called on a session whose matches haven't been
// individually settled yet. This helper is a thin wrapper around the same logic
// the match-settle route uses, kept here to avoid an HTTP self-call.
async function settleMatchInline(matchId: string) {
  await prisma.$transaction(async (tx) => {
    const m = await tx.match.findUnique({
      where: { id: matchId },
      include: { bets: true, session: true },
    });
    if (!m || !m.winningOutcomeId || m.status !== "CLOSED") return;

    const payouts = computePayouts({
      bets: m.bets.map((b) => ({
        id: b.id,
        userId: b.userId,
        outcomeId: b.outcomeId,
        stake: b.stake,
      })),
      winningOutcomeId: m.winningOutcomeId,
      rakeBps: m.session.rakeBps,
    });

    for (const p of payouts) {
      if (p.payout > 0) {
        const u = await tx.user.update({
          where: { id: p.userId },
          data: { chips: { increment: p.payout } },
        });
        await tx.transaction.create({
          data: {
            userId: p.userId,
            type: p.won ? "BET_WIN" : "BET_REFUND",
            amount: p.payout,
            balanceAfter: u.chips,
            betId: p.betId,
            matchId: m.id,
            sessionId: m.sessionId,
            note: p.won ? "Won bet" : "Refund (no winners)",
          },
        });
      }
      await tx.bet.update({
        where: { id: p.betId },
        data: {
          status: p.won ? "WON" : p.payout > 0 ? "REFUNDED" : "LOST",
          payout: p.payout,
          settledAt: new Date(),
        },
      });
    }
    const totalPool = m.bets.reduce((sum, b) => sum + b.stake, 0);
    const totalPaid = payouts.reduce((sum, p) => sum + p.payout, 0);
    await recordHouseRake(tx, {
      matchId: m.id,
      sessionId: m.sessionId,
      rakeBps: m.session.rakeBps,
      totalPool,
      totalPaid,
      note: `Rake retained for ${m.id}`,
    });
    await tx.match.update({
      where: { id: m.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });
  });
}
