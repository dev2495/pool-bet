import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

const Body = z.object({
  immediate: z.boolean().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

// Open or re-open a single match. With immediate=true, the scheduled
// one-hour window is overridden and bets can start right away.
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json().catch(() => ({})));

    const m = await prisma.match.findUnique({
      where: { id },
      include: { session: true },
    });
    if (!m) return err("Match not found", 404);
    if (m.status === "SETTLED" || m.status === "VOID") {
      return err("Finalised matches cannot be re-opened", 400);
    }
    if (m.status === "OPEN") return ok({ match: m });
    if (m.session.status !== "OPEN" && m.session.status !== "LIVE") {
      return err("Open the session before opening a match", 400);
    }

    const updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: "OPEN",
        bettingOpensAt: body.immediate ? new Date() : m.bettingOpensAt,
      },
    });
    return ok({ match: updated });
  });
}
