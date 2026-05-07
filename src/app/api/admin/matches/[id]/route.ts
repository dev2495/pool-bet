import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

type RouteCtx = { params: Promise<{ id: string }> };

// DELETE — only allowed if no bets exist.
export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const m = await prisma.match.findUnique({
      where: { id },
      include: { _count: { select: { bets: true } } },
    });
    if (!m) return err("Match not found", 404);
    if (m._count.bets > 0) return err("Cannot delete match with existing bets", 400);
    await prisma.match.delete({ where: { id: m.id } });
    return ok({ deleted: true });
  });
}
