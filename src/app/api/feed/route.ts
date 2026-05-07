import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { computeOdds, type MatchView } from "@/lib/odds";

export const dynamic = "force-dynamic";

// GET /api/feed — main player feed. Returns active match groups with matches
// and outcomes. Odds are controlled per match: OPEN hides odds, LIVE/CLOSED/
// SETTLED reveal odds and pool totals.
export async function GET() {
  return handle(async () => {
    const sess = await getSession();

    const sessions = await prisma.session.findMany({
      where: { status: { in: ["OPEN", "LIVE", "CLOSED", "SETTLED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        matches: {
          orderBy: { createdAt: "asc" },
          include: {
            outcomes: { orderBy: { id: "asc" } },
            _count: { select: { bets: true } },
          },
        },
      },
      take: 5,
    });

    // If user signed in, fetch their active bets to highlight and build current exposure.
    const myBetsByMatch: Record<string, { outcomeId: string; stake: number }[]> = {};
    let me: { id: string; name: string; chips: number } | null = null;
    if (sess?.kind === "user") {
      const u = await prisma.user.findUnique({ where: { id: sess.userId } });
      if (u) {
        me = { id: u.id, name: u.name, chips: u.chips };
        const bets = await prisma.bet.findMany({
          where: {
            userId: u.id,
            status: "ACTIVE",
            match: { sessionId: { in: sessions.map((s) => s.id) } },
          },
        });
        for (const b of bets) {
          (myBetsByMatch[b.matchId] ||= []).push({ outcomeId: b.outcomeId, stake: b.stake });
        }
      }
    }

    const view = sessions.map((s) => {
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        rakeBps: s.rakeBps,
        liveAt: s.liveAt,
        closedAt: s.closedAt,
        settledAt: s.settledAt,
        matches: s.matches.map((m) => {
          const odds: MatchView = computeOdds(m.outcomes, s.rakeBps);
          const oddsHidden = m.status === "OPEN" || m.status === "PENDING";
          const myBets = myBetsByMatch[m.id] || [];
          const myTotalStake = myBets.reduce((sum, b) => sum + b.stake, 0);
          return {
            id: m.id,
            name: m.name,
            description: m.description,
            status: m.status,
            startsAt: m.startsAt,
            bettingOpensAt: m.bettingOpensAt,
            source: m.source,
            homeCode: m.homeCode,
            awayCode: m.awayCode,
            winningOutcomeId: m.winningOutcomeId,
            betCount: m._count.bets,
            // Hide pool sizes and odds while this match is in hidden-open mode.
            outcomes: odds.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
              poolChips: oddsHidden ? null : o.poolChips,
              betCount: oddsHidden ? null : o.betCount,
              oddsDecimal: oddsHidden ? null : o.oddsDecimal,
              share: oddsHidden ? null : o.share,
            })),
            totalPool: oddsHidden ? null : odds.totalPool,
            myBets,
            myBook: {
              totalStake: myTotalStake,
              rows: odds.outcomes.map((o) => {
                const stakeOnOutcome = myBets
                  .filter((b) => b.outcomeId === o.id)
                  .reduce((sum, b) => sum + b.stake, 0);
                const grossReturn =
                  !oddsHidden && o.oddsDecimal != null
                    ? Math.floor(stakeOnOutcome * o.oddsDecimal)
                    : null;
                return {
                  outcomeId: o.id,
                  label: o.label,
                  stake: stakeOnOutcome,
                  grossReturn,
                  net: grossReturn == null ? null : grossReturn - myTotalStake,
                };
              }),
            },
          };
        }),
      };
    });

    return ok({
      me,
      sessions: view,
      // server time so clients can display "live since…"
      now: new Date().toISOString(),
    });
  });
}
