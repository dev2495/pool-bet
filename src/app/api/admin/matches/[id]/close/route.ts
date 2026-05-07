import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

type RouteCtx = { params: Promise<{ id: string }> };

// Close a single match (no more bets accepted on it).
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const m = await prisma.match.findUnique({ where: { id } });
    if (!m) return err("Match not found", 404);
    if (m.status !== "OPEN") return err("Match is not OPEN", 400);
    const updated = await prisma.match.update({
      where: { id: m.id },
      data: { status: "CLOSED" },
    });
    return ok({ match: updated });
  });
}
