import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [playerLedger, allPlayerLedger, houseLedger, users] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, loginCode: true } } },
        take: 300,
      }),
      prisma.transaction.findMany({ select: { amount: true } }),
      prisma.houseTransaction.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          session: { select: { id: true, name: true, status: true } },
          match: { select: { id: true, name: true } },
        },
        take: 300,
      }),
      prisma.user.findMany({ select: { id: true, chips: true } }),
    ]);

    const playerTxnTotal = allPlayerLedger.reduce((sum, t) => sum + t.amount, 0);
    const playerBalanceTotal = users.reduce((sum, u) => sum + u.chips, 0);
    const houseTotal = houseLedger.reduce((sum, t) => sum + t.amount, 0);

    return ok({
      totals: {
        playerTxnTotal,
        playerBalanceTotal,
        houseTotal,
        inBalance: playerTxnTotal === playerBalanceTotal,
      },
      playerLedger: playerLedger.map((t) => ({
        id: t.id,
        userId: t.userId,
        userName: t.user.name,
        loginCode: t.user.loginCode,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        note: t.note,
        betId: t.betId,
        matchId: t.matchId,
        sessionId: t.sessionId,
        createdAt: t.createdAt,
      })),
      houseLedger: houseLedger.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        totalPool: t.totalPool,
        totalPaid: t.totalPaid,
        rakeBps: t.rakeBps,
        note: t.note,
        matchId: t.matchId,
        matchName: t.match?.name ?? null,
        sessionId: t.sessionId,
        sessionName: t.session.name,
        sessionStatus: t.session.status,
        createdAt: t.createdAt,
      })),
    });
  });
}
