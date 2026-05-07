import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";
import { randomCode } from "@/lib/codes";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(3).max(40),
});

// GET /api/admin/users — list all users with quick stats
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bets: true } } },
    });
    return ok({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        loginCode: u.loginCode,
        chips: u.chips,
        bets: u._count.bets,
        createdAt: u.createdAt,
      })),
    });
  });
}

// POST /api/admin/users — create a user at zero chips and generate a unique login code.
// Admin chip grants happen through the ledger endpoint after code creation.
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const { name, phone } = Body.parse(await req.json());

    const phoneNorm = phone.trim();
    const existing = await prisma.user.findUnique({ where: { phone: phoneNorm } });
    if (existing) return err("A user with that phone already exists", 409);

    // Generate a code, retrying on (extremely unlikely) collision.
    let loginCode = "";
    for (let i = 0; i < 10; i++) {
      const candidate = randomCode([3, 3]);
      const clash = await prisma.user.findUnique({ where: { loginCode: candidate } });
      if (!clash) {
        loginCode = candidate;
        break;
      }
    }
    if (!loginCode) return err("Could not generate unique code, try again", 500);

    const user = await prisma.user.create({
      data: { name: name.trim(), phone: phoneNorm, loginCode, chips: 0 },
    });

    return ok({ user });
  });
}
