import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { computePayouts } from "@/lib/odds";
import { recordHouseRake } from "@/lib/house-ledger";

const Body = z.object({ winningOutcomeId: z.string().min(1) });
type RouteCtx = { params: Promise<{ id: string }> };

// Settle a match by selecting the winning outcome. Pays out winners from the
// pool, takes the configured rake, and writes ledger entries.
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const { winningOutcomeId } = Body.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const m = await tx.match.findUnique({
        where: { id },
        include: { bets: true, outcomes: true, session: true },
      });
      if (!m) throw new Error("Match not found");
      if (m.status !== "CLOSED") throw new Error("Close the match before settling it");
      if (!m.outcomes.find((o) => o.id === winningOutcomeId))
        throw new Error("Winning outcome must belong to this match");

      const payouts = computePayouts({
        bets: m.bets.map((b) => ({
          id: b.id,
          userId: b.userId,
          outcomeId: b.outcomeId,
          stake: b.stake,
        })),
        winningOutcomeId,
        rakeBps: m.session.rakeBps,
      });

      let totalPaid = 0;
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
              note: p.won ? "Bet won" : "Refund (no winners)",
            },
          });
          totalPaid += p.payout;
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

      await tx.match.update({
        where: { id: m.id },
        data: {
          status: "SETTLED",
          winningOutcomeId,
          settledAt: new Date(),
        },
      });

      const totalPool = m.bets.reduce((s, b) => s + b.stake, 0);
      const houseRake = await recordHouseRake(tx, {
        matchId: m.id,
        sessionId: m.sessionId,
        rakeBps: m.session.rakeBps,
        totalPool,
        totalPaid,
        note: `Rake retained for ${m.name}`,
      });

      return {
        matchId: m.id,
        winningOutcomeId,
        totalPool,
        totalPaid,
        rakeChips: houseRake,
        bets: payouts.length,
      };
    });

    return ok(result);
  });
}

// VOID a match: refund every bet at face value. No winner needed.
export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;

    await prisma.$transaction(async (tx) => {
      const m = await tx.match.findUnique({
        where: { id },
        include: { bets: true },
      });
      if (!m) throw new Error("Match not found");
      if (m.status === "SETTLED" || m.status === "VOID")
        throw new Error("Match already finalised");

      for (const b of m.bets) {
        if (b.status !== "ACTIVE") continue;
        const u = await tx.user.update({
          where: { id: b.userId },
          data: { chips: { increment: b.stake } },
        });
        await tx.transaction.create({
          data: {
            userId: b.userId,
            type: "BET_REFUND",
            amount: b.stake,
            balanceAfter: u.chips,
            betId: b.id,
            matchId: m.id,
            sessionId: m.sessionId,
            note: "Match voided — stake refunded",
          },
        });
        await tx.bet.update({
          where: { id: b.id },
          data: { status: "REFUNDED", payout: b.stake, settledAt: new Date() },
        });
      }

      await tx.match.update({
        where: { id: m.id },
        data: { status: "VOID", settledAt: new Date() },
      });
      if (m.id) {
        await tx.houseTransaction.deleteMany({ where: { matchId: m.id } });
      }
    });

    return ok({ voided: true });
  });
}
