import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

// State transitions for a session:
//   open    : DRAFT  -> OPEN     (match betting windows may begin)
//   live    : OPEN   -> LIVE     (odds REVEALED to players)
//   close   : OPEN|LIVE -> CLOSED (only after every match is already locked/final)
//   settle  : CLOSED -> SETTLED  (only after every match is SETTLED or VOID)
//
// Match betting is controlled per match. Session close must never bulk-close
// IPL/future matches, because one accidental click would lock the whole board.

const Body = z.object({ action: z.enum(["open", "live", "close", "settle"]) });
type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const { action } = Body.parse(await req.json());
    const s = await prisma.session.findUnique({
      where: { id },
      include: { matches: { include: { bets: true, outcomes: true } } },
    });
    if (!s) return err("Session not found", 404);

    if (action === "open") {
      if (s.status !== "DRAFT") return err("Only DRAFT sessions can be opened", 400);
      if (s.matches.length === 0) return err("Add at least one match before opening", 400);
      // Bring all matches into the OPEN state too.
      await prisma.$transaction([
        prisma.session.update({ where: { id: s.id }, data: { status: "OPEN" } }),
        prisma.match.updateMany({
          where: { sessionId: s.id, status: "PENDING" },
          data: { status: "OPEN" },
        }),
      ]);
      return ok({ status: "OPEN" });
    }

    if (action === "live") {
      if (s.status !== "OPEN") return err("Only OPEN sessions can go LIVE", 400);
      await prisma.session.update({
        where: { id: s.id },
        data: { status: "LIVE", liveAt: new Date() },
      });
      return ok({ status: "LIVE" });
    }

    if (action === "close") {
      if (s.status !== "OPEN" && s.status !== "LIVE")
        return err("Session cannot be closed from this state", 400);
      const acceptingMatches = s.matches.filter((m) => m.status === "PENDING" || m.status === "OPEN");
      if (acceptingMatches.length > 0) {
        return err(
          `Close each match manually first. ${acceptingMatches.length} match(es) are still open or scheduled.`,
          400
        );
      }
      await prisma.session.update({
        where: { id: s.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      return ok({ status: "CLOSED" });
    }

    // settle: every match must already be settled or voided individually.
    if (action === "settle") {
      if (s.status !== "CLOSED") return err("Settle only allowed after CLOSED", 400);
      const unresolved = s.matches.filter((m) => m.status !== "SETTLED" && m.status !== "VOID");
      if (unresolved.length > 0)
        return err(
          `Settle or void ${unresolved.length} match(es) before settling the session`,
          400
        );

      await prisma.session.update({
        where: { id: s.id },
        data: { status: "SETTLED", settledAt: new Date() },
      });
      return ok({ status: "SETTLED" });
    }
  });
}
