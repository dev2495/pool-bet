import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

type RouteCtx = { params: Promise<{ id: string }> };

// Reveal odds for this match only. Bets continue to be accepted until the match
// is closed manually.
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const m = await prisma.match.findUnique({ where: { id }, include: { session: true } });
    if (!m) return err("Match not found", 404);
    if (m.status !== "OPEN") return err("Only OPEN hidden matches can go live", 400);
    if (m.session.status !== "OPEN" && m.session.status !== "LIVE") {
      return err("Open the match group before taking a match live", 400);
    }
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: { status: "LIVE" },
    });
    return ok({ match: updated });
  });
}
