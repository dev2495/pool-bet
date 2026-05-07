import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";
import { computeOdds } from "@/lib/odds";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/admin/sessions/[id] — full detail with matches/outcomes/odds
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        matches: {
          orderBy: { createdAt: "asc" },
          include: {
            outcomes: { orderBy: { id: "asc" } },
            bets: {
              orderBy: { createdAt: "desc" },
              include: {
                user: { select: { id: true, name: true, loginCode: true } },
                outcome: { select: { id: true, label: true } },
              },
            },
            _count: { select: { bets: true } },
          },
        },
      },
    });
    if (!session) return err("Session not found", 404);

    const ledger = await prisma.transaction.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, loginCode: true } } },
      take: 100,
    });
    const houseLedger = await prisma.houseTransaction.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
    });

    const matches = session.matches.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      startsAt: m.startsAt,
      bettingOpensAt: m.bettingOpensAt,
      source: m.source,
      homeCode: m.homeCode,
      awayCode: m.awayCode,
      status: m.status,
      winningOutcomeId: m.winningOutcomeId,
      betCount: m._count.bets,
      bets: m.bets.map((b) => ({
        id: b.id,
        userId: b.userId,
        userName: b.user.name,
        loginCode: b.user.loginCode,
        outcomeId: b.outcomeId,
        outcomeLabel: b.outcome.label,
        stake: b.stake,
        payout: b.payout,
        status: b.status,
        createdAt: b.createdAt,
        settledAt: b.settledAt,
      })),
      ...computeOdds(m.outcomes, session.rakeBps),
    }));

    return ok({
      session: {
        id: session.id,
        name: session.name,
        rakeBps: session.rakeBps,
        status: session.status,
        createdAt: session.createdAt,
        liveAt: session.liveAt,
        closedAt: session.closedAt,
        settledAt: session.settledAt,
      },
      matches,
      ledger: ledger.map((t) => ({
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
      houseLedger,
    });
  });
}

const Patch = z.object({ rakeBps: z.number().int().min(0).max(9999).optional() });

// PATCH — update session settings (only valid in DRAFT/OPEN, before LIVE).
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = Patch.parse(await req.json());
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return err("Session not found", 404);
    if (s.status !== "DRAFT" && s.status !== "OPEN")
      return err("Rake can only be changed before the session goes live", 400);
    const updated = await prisma.session.update({
      where: { id: s.id },
      data: { rakeBps: body.rakeBps ?? s.rakeBps },
    });
    return ok({ session: updated });
  });
}

// DELETE — only DRAFT sessions can be deleted (no bets exist).
export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) return err("Session not found", 404);
    if (s.status !== "DRAFT") return err("Only DRAFT sessions can be deleted", 400);
    await prisma.session.delete({ where: { id: s.id } });
    return ok({ deleted: true });
  });
}
