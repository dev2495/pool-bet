import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

const Body = z.object({
  // Positive to pay chips in, negative to pay chips out. Use action=settle to cash out the full balance.
  amount: z.number().int().optional(),
  action: z.enum(["settle"]).optional(),
  note: z.string().max(200).optional(),
}).refine((body) => body.action === "settle" || (body.amount != null && body.amount !== 0), {
  message: "Amount must be non-zero unless settling the player",
});
type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { amount: requestedAmount, action, note } = Body.parse(await req.json());
    const { id: userId } = await ctx.params;

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "settle") {
        const current = await tx.user.findUnique({ where: { id: userId } });
        if (!current) throw new Error("User not found");
        if (current.chips <= 0) throw new Error("Player has no chips to settle");

        const amount = -current.chips;
        const updatedCount = await tx.user.updateMany({
          where: { id: userId, chips: current.chips },
          data: { chips: 0 },
        });
        if (updatedCount.count !== 1) throw new Error("Player balance changed, retry settlement");

        const upd = await tx.user.findUnique({ where: { id: userId } });
        if (!upd) throw new Error("User not found");
        await tx.transaction.create({
          data: {
            userId,
            type: "PAY_OUT",
            amount,
            balanceAfter: upd.chips,
            note: note || `Player settled payout: paid ${current.chips} chips`,
          },
        });
        return upd;
      }

      const amount = requestedAmount ?? 0;
      const updatedCount = await tx.user.updateMany({
        where: { id: userId, ...(amount < 0 ? { chips: { gte: Math.abs(amount) } } : {}) },
        data: { chips: { increment: amount } },
      });
      if (updatedCount.count !== 1) {
        const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!exists) throw new Error("User not found");
        throw new Error("Insufficient chips for this deduction");
      }
      const upd = await tx.user.findUnique({ where: { id: userId } });
      if (!upd) throw new Error("User not found");
      await tx.transaction.create({
        data: {
          userId,
          type: amount > 0 ? "PAY_IN" : "PAY_OUT",
          amount,
          balanceAfter: upd.chips,
          note: note || (amount > 0 ? "Player pay-in" : "Player payout"),
        },
      });
      return upd;
    });

    return ok({ user: updated });
  });
}

// GET ledger for a user
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const allTxns = await prisma.transaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    const txns = allTxns.slice(0, 200);
    const isLegacyReset = (note: string | null) => note?.startsWith("Session settled reset:") ?? false;
    const isSettlementPayout = (t: (typeof allTxns)[number]) =>
      (t.type === "PAY_OUT" && t.balanceAfter === 0) || (t.type === "ADJUST" && isLegacyReset(t.note));

    const lifetimePayIn = allTxns
      .filter((t) => t.type === "PAY_IN" || t.type === "GRANT")
      .reduce((sum, t) => sum + Math.max(0, t.amount), 0);
    const lifetimePayOut = allTxns
      .filter((t) => t.type === "PAY_OUT" || (t.type === "ADJUST" && isLegacyReset(t.note)))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const latestSettlementIndex = allTxns.findIndex(isSettlementPayout);
    const currentCycle = latestSettlementIndex === -1 ? allTxns : allTxns.slice(0, latestSettlementIndex);
    const currentCyclePayIn = currentCycle
      .filter((t) => t.type === "PAY_IN" || t.type === "GRANT")
      .reduce((sum, t) => sum + Math.max(0, t.amount), 0);
    const currentCycleStaked = currentCycle
      .filter((t) => t.type === "BET_PLACE")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const currentCycleReturned = currentCycle
      .filter((t) => t.type === "BET_WIN" || t.type === "BET_REFUND")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentCyclePnl = currentCycleReturned - currentCycleStaked;
    return ok({
      txns,
      summary: {
        lifetimePayIn,
        lifetimePayOut,
        currentCyclePayIn,
        currentCycleStaked,
        currentCycleReturned,
        currentCyclePnl,
        settlementCount: allTxns.filter(isSettlementPayout).length,
      },
    });
  });
}
