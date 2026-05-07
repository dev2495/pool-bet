import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  matchId: z.string().min(1),
  outcomeId: z.string().min(1),
  stake: z.number().int().min(50, "Minimum bet is 50 chips").max(10_000_000),
});

// POST /api/bets — place a bet. Allowed when the match is OPEN (hidden odds) or
// LIVE (visible odds), and its match group is active.
export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { matchId, outcomeId, stake } = Body.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { outcomes: true, session: true },
      });
      if (!match) throw new ApiError("Match not found", 404);
      if (match.status !== "OPEN" && match.status !== "LIVE")
        throw new ApiError("Match is not accepting bets");
      if (match.bettingOpensAt && match.bettingOpensAt.getTime() > Date.now()) {
        throw new ApiError(
          `Betting opens at ${match.bettingOpensAt.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          })} IST`
        );
      }
      const sessionStatus = match.session.status;
      if (sessionStatus !== "OPEN" && sessionStatus !== "LIVE")
        throw new ApiError("Session is not accepting bets");
      const outcome = match.outcomes.find((o) => o.id === outcomeId);
      if (!outcome) throw new ApiError("Outcome does not belong to this match");

      const debit = await tx.user.updateMany({
        where: { id: user.id, chips: { gte: stake } },
        data: { chips: { decrement: stake } },
      });
      if (debit.count !== 1) throw new ApiError("Not enough chips");

      const updatedUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!updatedUser) throw new ApiError("User missing", 404);

      // Create the bet
      const bet = await tx.bet.create({
        data: { userId: user.id, matchId, outcomeId, stake, status: "ACTIVE" },
      });

      // Update outcome cached pool
      await tx.outcome.update({
        where: { id: outcomeId },
        data: {
          poolChips: { increment: stake },
          betCount: { increment: 1 },
        },
      });

      // Ledger
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "BET_PLACE",
          amount: -stake,
          balanceAfter: updatedUser.chips,
          betId: bet.id,
          matchId,
          sessionId: match.sessionId,
          note: `Bet on ${outcome.label}`,
        },
      });

      return { bet, balance: updatedUser.chips };
    });

    return ok(result);
  });
}

// GET /api/bets — current user's bets
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const bets = await prisma.bet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        match: { select: { id: true, name: true, status: true, sessionId: true } },
        outcome: { select: { id: true, label: true } },
      },
      take: 200,
    });
    return ok({ bets });
  });
}
