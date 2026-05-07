import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

const Body = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1).max(140),
  description: z.string().max(500).optional(),
  startsAt: z.string().datetime().optional().or(z.literal("")),
  outcomes: z.array(z.string().min(1).max(80)).min(2).max(10),
});

// POST /api/admin/matches — create a match with its outcomes (allowed while session DRAFT or OPEN).
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { sessionId, name, description, startsAt: startsAtRaw, outcomes } = Body.parse(await req.json());
    const s = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!s) return err("Session not found", 404);
    if (s.status !== "DRAFT" && s.status !== "OPEN")
      return err("Cannot add matches once session is LIVE/CLOSED/SETTLED", 400);

    // Initial match status mirrors session state.
    const initialStatus = s.status === "OPEN" ? "OPEN" : "PENDING";
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const bettingOpensAt = startsAt ? new Date(startsAt.getTime() - 60 * 60 * 1000) : null;

    const match = await prisma.match.create({
      data: {
        sessionId,
        name,
        description,
        startsAt,
        bettingOpensAt,
        status: initialStatus,
        outcomes: { create: outcomes.map((label) => ({ label })) },
      },
      include: { outcomes: true },
    });

    return ok({ match });
  });
}
