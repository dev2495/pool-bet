import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(120),
  rakeBps: z.number().int().min(0).max(9999).default(500),
});

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { matches: true } } },
    });
    return ok({ sessions });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { name, rakeBps } = Body.parse(await req.json());
    const session = await prisma.session.create({
      data: { name, rakeBps, status: "DRAFT" },
    });
    return ok({ session });
  });
}
