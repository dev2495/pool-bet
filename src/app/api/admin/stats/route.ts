import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/admin/stats — leaderboard + per-session P/L for every player.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany();
    const bets = await prisma.bet.findMany({
      include: { match: { select: { sessionId: true } } },
    });
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: "desc" },
    });
    const houseLedger = await prisma.houseTransaction.findMany();

    const perUser = new Map<string, { staked: number; returned: number; bets: number; wins: number; losses: number }>();
    for (const u of users) {
      perUser.set(u.id, { staked: 0, returned: 0, bets: 0, wins: 0, losses: 0 });
    }
    for (const b of bets) {
      const r = perUser.get(b.userId);
      if (!r) continue;
      r.bets += 1;
      r.staked += b.stake;
      r.returned += b.payout || 0;
      if (b.status === "WON") r.wins += 1;
      else if (b.status === "LOST") r.losses += 1;
    }

    const leaderboard = users
      .map((u) => {
        const s = perUser.get(u.id)!;
        return {
          id: u.id,
          name: u.name,
          phone: u.phone,
          chips: u.chips,
          loginCode: u.loginCode,
          ...s,
          pnl: s.returned - s.staked,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);

    // Quick session list with totals
    const sessionTotals = await Promise.all(
      sessions.map(async (s) => {
        const matchBets = bets.filter((b) => b.match.sessionId === s.id);
        const totalPool = matchBets.reduce((acc, b) => acc + b.stake, 0);
        const matchCount = await prisma.match.count({ where: { sessionId: s.id } });
        const playerCount = new Set(matchBets.map((b) => b.userId)).size;
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          rakeBps: s.rakeBps,
          createdAt: s.createdAt,
          totalPool,
          matchCount,
          playerCount,
        };
      })
    );

    return ok({
      leaderboard,
      sessions: sessionTotals,
      totals: {
        users: users.length,
        chipsInCirculation: users.reduce((acc, u) => acc + u.chips, 0),
        totalBets: bets.length,
        totalStaked: bets.reduce((acc, b) => acc + b.stake, 0),
        totalReturned: bets.reduce((acc, b) => acc + (b.payout || 0), 0),
        houseRake: houseLedger.reduce((acc, h) => acc + h.amount, 0),
      },
    });
  });
}
